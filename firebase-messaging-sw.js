// ============================================================
//  firebase-messaging-sw.js
//  Service Worker para notificaciones push de Marina Pilates
//  Subir este archivo a la RAÍZ de tu repositorio GitHub
//  (al lado del index.html)
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

// Este handler se dispara cuando llega una notificación con la app CERRADA
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Notificación en background:', payload);
    const { title, body } = payload.notification || {};
    self.registration.showNotification(title || 'Marina Pilates', {
        body: body || '',
        icon: 'https://marina-pilates.github.io/icon-192.png', // opcional
        badge: 'https://marina-pilates.github.io/icon-192.png',
        tag: 'marina-pilates-notif', // evita duplicados
        requireInteraction: true     // no desaparece sola en Android
    });
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
