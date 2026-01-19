// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB4anf0HztjmqM8cAuOY-btZl3HlDwk0l4",
  authDomain: "kinesis-f2b17.firebaseapp.com",
  projectId: "kinesis-f2b17",
  storageBucket: "kinesis-f2b17.firebasestorage.app",
  messagingSenderId: "838076750848",
  appId: "1:838076750848:web:1f14d39691d300d7dd0ce5",
  measurementId: "G-NG31LFHDJE"
};

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);

// Riferimenti ai servizi Firebase
const db = firebase.firestore();
const auth = firebase.auth();
