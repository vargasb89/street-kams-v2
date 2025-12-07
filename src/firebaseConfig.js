// src/firebaseConfig.js

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

export const firebaseConfig = {
  apiKey: "AIzaSyCqHtCOeO5gSuSy5N6qMncplymxJvuoT-s",
  authDomain: "street-kams-v2.firebaseapp.com",
  projectId: "street-kams-v2",
  storageBucket: "street-kams-v2.firebasestorage.app",
  messagingSenderId: "605151403398",
  appId: "1:605151403398:web:49750bda585e1130956007",
  measurementId: "G-P16YRWECY6"
};

// Inicializamos Firebase una vez
export const firebaseApp = initializeApp(firebaseConfig);

// (Opcional) Analytics
export const analytics = getAnalytics(firebaseApp);
