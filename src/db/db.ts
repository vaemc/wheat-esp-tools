import { openDB } from "idb";

const db = await openDB("db1", 1, {
  upgrade(db) {
    db.createObjectStore("paths",{ keyPath: 'path' });
  },
  blocked(currentVersion, blockedVersion, event) {},
  blocking(currentVersion, blockedVersion, event) {},
  terminated() {},
});

export default db;

export async function insert(storeName: string, value: string) {
  await db.add(storeName, value);
}

export async function findAll(storeName: string) {
  await db.getAll(storeName);
}

export async function edit(storeName: string, value: string) {
  await db.put(storeName, value);
}
