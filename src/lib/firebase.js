import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigurado = Boolean(config.apiKey && config.projectId);

if (!firebaseConfigurado && typeof console !== "undefined") {
  const faltando = Object.entries({
    VITE_FIREBASE_API_KEY: config.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
    VITE_FIREBASE_PROJECT_ID: config.projectId,
    VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
    VITE_FIREBASE_APP_ID: config.appId,
  }).filter(([, v]) => !v).map(([k]) => k);
  console.error(
    `[VPScouts] Firebase não configurado — variável(is) de ambiente ausente(s) ou com nome errado no Netlify: ${faltando.join(", ")}. ` +
    `O app vai funcionar só neste aparelho, sem sincronizar com outros dispositivos, até isso ser corrigido em Site settings → Environment variables.`
  );
}

let db = null;
if (firebaseConfigurado) {
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  // Cache local persistente: o app continua funcionando com os últimos dados
  // conhecidos mesmo sem internet, e sincroniza sozinho assim que a conexão
  // voltar. Sem isso, qualquer oscilação de rede fazia o app "esquecer" tudo
  // e voltar pra tela inicial, como se fosse a primeira vez.
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e) {
    // Se o navegador não suportar (raro) ou já tiver sido inicializado antes,
    // cai para a inicialização padrão, sem cache offline.
    db = getFirestore(app);
  }
}

export { db };
