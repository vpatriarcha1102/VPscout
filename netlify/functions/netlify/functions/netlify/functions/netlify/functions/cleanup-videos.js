import { ListMultipartUploadsCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getR2Client, getBucket } from "./_r2Client.js";

const IDADE_MAX_MS = 24 * 60 * 60 * 1000; // 24h

export async function handler() {
  try {
    const client = getR2Client();
    const bucket = getBucket();

    const lista = await client.send(new ListMultipartUploadsCommand({ Bucket: bucket, Prefix: "videos/" }));
    const uploads = lista.Uploads || [];
    const agora = Date.now();

    let removidos = 0;
    for (const u of uploads) {
      const iniciado = u.Initiated ? new Date(u.Initiated).getTime() : 0;
      if (agora - iniciado < IDADE_MAX_MS) continue;
      try {
        await client.send(
          new AbortMultipartUploadCommand({ Bucket: bucket, Key: u.Key, UploadId: u.UploadId })
        );
        removidos++;
      } catch (e) {
        console.error("[cleanup-videos] falha ao abortar", u.Key, e);
      }
    }

    console.log(`[cleanup-videos] ${removidos}/${uploads.length} uploads abandonados removidos.`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, removidos, total: uploads.length }) };
  } catch (e) {
    console.error("[cleanup-videos]", e);
    return { statusCode: 500, body: JSON.stringify({ erro: "Falha na limpeza automática." }) };
  }
}

export const config = { schedule: "@daily" };
