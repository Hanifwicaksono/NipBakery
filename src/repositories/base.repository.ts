import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query
} from 'firebase/firestore'
import type {
  CollectionReference,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore'
import { db, auth } from '@/firebase/config'

export abstract class BaseRepository<T extends { id: string }> {
  protected collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  // Get current user's UID or throw error if not authenticated
  protected getUserId(): string {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User is not authenticated. Cannot perform repository operations.');
    }
    return user.uid;
  }

  // Get Reference to the user-specific subcollection: users/{userId}/{collectionName}
  protected getCollectionRef(): CollectionReference<DocumentData> {
    const userId = this.getUserId();
    return collection(db, 'users', userId, this.collectionName);
  }

  // Get Reference to a specific document inside the subcollection
  protected getDocRef(id: string) {
    const userId = this.getUserId();
    return doc(db, 'users', userId, this.collectionName, id);
  }

  // Create or overwrite a document
  async create(data: T): Promise<void> {
    const docRef = this.getDocRef(data.id);
    await setDoc(docRef, { ...data, lastUpdated: new Date().toISOString() });
  }

  // Read a document by ID
  async getById(id: string): Promise<T | null> {
    const docRef = this.getDocRef(id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as T;
    }
    return null;
  }

  // Update specific fields of a document
  async update(id: string, data: Partial<T>): Promise<void> {
    const docRef = this.getDocRef(id);
    await updateDoc(docRef, { ...data, lastUpdated: new Date().toISOString() });
  }

  // Delete a document
  async delete(id: string): Promise<void> {
    const docRef = this.getDocRef(id);
    await deleteDoc(docRef);
  }

  // List all documents in the collection
  async list(): Promise<T[]> {
    const collectionRef = this.getCollectionRef();
    const querySnapshot = await getDocs(collectionRef);
    const results: T[] = [];
    querySnapshot.forEach((docSnap) => {
      results.push(docSnap.data() as T);
    });
    return results;
  }

  // Query/filter documents
  async query(constraints: QueryConstraint[]): Promise<T[]> {
    const collectionRef = this.getCollectionRef();
    const q = query(collectionRef, ...constraints);
    const querySnapshot = await getDocs(q);
    const results: T[] = [];
    querySnapshot.forEach((docSnap) => {
      results.push(docSnap.data() as T);
    });
    return results;
  }
}
