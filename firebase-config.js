const firebaseConfig = {
    apiKey: "AIzaSyDJDMsiLBABUdPMNaRyfJ-s2MTwse-kX1w",
    authDomain: "marina-pilates-730fb.firebaseapp.com",
    projectId: "marina-pilates-730fb",
    storageBucket: "marina-pilates-730fb.firebasestorage.app",
    messagingSenderId: "392495630154",
    appId: "1:392495630154:web:735dca0f037ded59ad63b3",
    measurementId: "G-55DKQ56CH1"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
