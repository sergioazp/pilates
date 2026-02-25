// ============================================================
//  firebase-messaging-sw.js
//  Service Worker para notificaciones push de Marina Pilates
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDJDMsiLBABUdPMNaRyfJ-s2MTwse-kX1w",
    projectId: "marina-pilates-730fb",
    messagingSenderId: "392495630154",
    appId: "1:392495630154:web:735dca0f037ded59ad63b3"
});

const messaging = firebase.messaging();

// Dejamos esto solo para ver en la consola que llegó, 
// pero ELIMINAMOS el "showNotification" para evitar el duplicado.
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Notificación recibida en background:', payload);
});

// Al hacer click en la notificación, abre la app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow('/');
        })
    );
});
