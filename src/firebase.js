import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyDezDsIPHOvgE4VeBrAgznjCszEbXQfJhY",
  authDomain: "synclisten-31da9.firebaseapp.com",
  databaseURL: "https://synclisten-31da9-default-rtdb.firebaseio.com",
  projectId: "synclisten-31da9",
  storageBucket: "synclisten-31da9.firebasestorage.app",
  messagingSenderId: "492278616322",
  appId: "1:492278616322:web:1233659698ac26bf6ff21b"
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)