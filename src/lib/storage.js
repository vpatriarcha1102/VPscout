// Shim que imita a mesma API window.storage usada durante o desenvolvimento
// no Claude (get/set/delete/list), com uma função extra "subscribe" para
// sincronização em tempo real entre dispositivos.
//
// - Se o Firebase estiver configurado (ver README, seção "Sincronizar entre
//   dispositivos"), os dados ficam no Firestore e QUALQUER dispositivo que
//   abrir o app vê os mesmos dados, em tempo real.
// - Se o Firebase NÃO estiver configurado, o app cai automaticamente para
//   localStorage — funciona normalmente, mas só naquele navegador/aparelho.
import {
  doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, onSnapshot, documentId,
} from "firebase/firestore";
import { firebaseConfigurado, db } from "./firebase";

const PREFIX_LOCAL = "vpscouts:";
const COLLECTION = "vpscouts_kv";

/* ---------- Fallback: localStorage (um dispositivo só) ---------- */
const storageLocal = {
  async get(key) {
    try {
      const raw = window.localStorage.getItem(PREFIX_LOCAL + key);
      return raw === null ? null : { key, value: raw };
    } catch (e) { return null; }
  },
  async set(key, value) {
    try { window.localStorage.setItem(PREFIX_LOCAL + key, value); return { key, value }; }
    catch (e) { return null; }
  },
  async delete(key) {
    try { window.localStorage.removeItem(PREFIX_LOCAL + key); return { key, deleted: true }; }
    catch (e) { return null; }
  },
  async list(prefix = "") {
    try {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(PREFIX_LOCAL + prefix)) keys.push(k.slice(PREFIX_LOCAL.length));
      }
      return { keys };
    } catch (e) { return { keys: [] }; }
  },
  // Sem backend compartilhado não existe "outro dispositivo" pra escutar —
  // por isso não definimos subscribe aqui (o App já checa se existe antes de usar).
};

/* ---------- Firestore: dados compartilhados entre todos os dispositivos ---------- */
const storageFirestore = {
  async get(key) {
    try {
      const snap = await getDoc(doc(db, COLLECTION, key));
      return snap.exists() ? { key, value: snap.data().value } : null;
    } catch (e) { return null; }
  },
  async set(key, value) {
    try {
      await setDoc(doc(db, COLLECTION, key), { value, atualizadoEm: Date.now() });
      return { key, value };
    } catch (e) { return null; }
  },
  async delete(key) {
    try { await deleteDoc(doc(db, COLLECTION, key)); return { key, deleted: true }; }
    catch (e) { return null; }
  },
  async list(prefix = "") {
    try {
      const col = collection(db, COLLECTION);
      const q = prefix
        ? query(col, where(documentId(), ">=", prefix), where(documentId(), "<", prefix + "\uf8ff"))
        : query(col);
      const snaps = await getDocs(q);
      return { keys: snaps.docs.map((d) => d.id) };
    } catch (e) { return { keys: [] }; }
  },
  subscribe(key, cb) {
    try {
      return onSnapshot(doc(db, COLLECTION, key), (snap) => {
        if (snap.exists()) cb(snap.data().value);
      });
    } catch (e) { return () => {}; }
  },
};

export function installStorageShim() {
  if (typeof window === "undefined") return;
  window.storage = firebaseConfigurado ? storageFirestore : storageLocal;
}
