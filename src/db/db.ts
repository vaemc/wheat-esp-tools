import { openDB } from "idb";

const db = await openDB("database", 1, {
  upgrade(db, oldVersion, newVersion, transaction, event) {
    
  },
  blocked(currentVersion, blockedVersion, event) {
    
  },
  blocking(currentVersion, blockedVersion, event) {
   
  },
  terminated() {
   
  },
});

export default db;

export async function insert(storeName: string, value: any) {
  await db.add(storeName, value);
}

export async function findAll(storeName: string) {
  await db.getAll(storeName);
}

export async function edit(storeName: string, value: any) {
  await db.put(storeName, value);
}

