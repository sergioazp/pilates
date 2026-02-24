const { useState, useEffect } = React;


// Feriados de Argentina 2026 + opción para custom
const FERIADOS_FIJOS = [
    '2026-01-01', // Año Nuevo
    '2026-02-09', // Carnaval
    '2026-02-10', // Carnaval
    '2026-03-24', // Memorial de Malvinas
    '2026-04-02', // Día de Malvinas
    '2026-04-10', // Viernes Santo
    '2026-05-01', // Día del Trabajador
    '2026-05-25', // Revolución de Mayo
    '2026-06-17', // Guemes
    '2026-06-20', // Bandera
    '2026-07-09', // Independencia
    '2026-07-17', // Muerte del Gral Güemes
    '2026-08-17', // Muerte del Gral San Martín
    '2026-10-12', // Respeto a la Diversidad Cultural
    '2026-11-02', // Difuntos
    '2026-12-08', // Inmaculada Concepción
    '2026-12-25'  // Navidad
];

// Helper para formatear fecha sin problemas de timezone
const fechaLocal = (fecha) => {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const FirebaseService = {
    // Inicializar datos de prueba si no existen
    async inicializarDatos() {
        try {
            const testDoc = await db.collection('alumnos').doc('test').get();
            if (!testDoc.exists) {
                console.log('Inicializando datos de prueba...');
                
                // Alumnos de prueba
                const alumnosPrueba = [
                    { id: '1', nombre: "Ailín", apellido: "Millas", email: "ailin.millas@gmail.com", abono: "2x_semana", clasesTotales: 8, clasesUsadas: 2, clasesPendientes: 0, horariosAsignados: ["Lunes-18:00", "Miércoles-19:00"], activo: true },
                    { id: '2', nombre: "Denise", apellido: "Ferdman", email: "denferd@gmail.com", abono: "3x_semana", clasesTotales: 12, clasesUsadas: 5, clasesPendientes: 1, horariosAsignados: ["Lunes-19:00", "Martes-08:00", "Jueves-09:00"], activo: true },
                    { id: '3', nombre: "Noelia", apellido: "Soria", email: "noeliaa.soriaa@gmail.com", abono: "1x_semana", clasesTotales: 4, clasesUsadas: 1, clasesPendientes: 0, horariosAsignados: ["Miércoles-18:00"], activo: true },
                    { id: '4', nombre: "Bettina", apellido: "Fernández", email: "bettinacefer@hotmail.com", abono: "4x_semana", clasesTotales: 16, clasesUsadas: 8, clasesPendientes: 0, horariosAsignados: ["Lunes-20:00", "Martes-19:00", "Miércoles-20:00", "Jueves-19:00"], activo: true },
                    { id: '5', nombre: "Paula", apellido: "Masquelet", email: "masqueletpaula@gmail.com", abono: "2x_semana", clasesTotales: 8, clasesUsadas: 3, clasesPendientes: 1, horariosAsignados: ["Martes-20:00", "Jueves-20:00"], activo: true },
                    { id: '6', nombre: "Sergio", apellido: "Azpeitia", email: "sergioazp@gmail.com", abono: "2x_semana", clasesTotales: 8, clasesUsadas: 0, clasesPendientes: 0, horariosAsignados: ["Lunes-18:00", "Viernes-19:00"], activo: true }
                ];
                
                for (const alumno of alumnosPrueba) {
                    await db.collection('alumnos').doc(alumno.id).set(alumno);
                }
                
                // Horarios
                await db.collection('config').doc('horarios').set({
                    "Lunes": ["18:00", "19:00", "20:00"],
                    "Martes": ["08:00", "09:00", "18:00", "19:00", "20:00"],
                    "Miércoles": ["08:00", "09:00", "18:00", "19:00", "20:00"],
                    "Jueves": ["08:00", "09:00", "18:00", "19:00", "20:00"],
                    "Viernes": ["18:00", "19:00", "20:00"]
                });
                
                // Precios - SOLO SI NO EXISTEN
                const preciosDoc = await db.collection('config').doc('precios').get();
                if (!preciosDoc.exists) {
                    await db.collection('config').doc('precios').set({
                        "1x_semana": 15000,
                        "2x_semana": 25000,
                        "3x_semana": 35000,
                        "4x_semana": 42000
                    });
                }
                
                // Cancelaciones
                await db.collection('cancelaciones').doc('1').set({
                    id: 1,
                    alumno: "Denise Ferdman",
                    dia: "Martes",
                    hora: "08:00",
                    fecha: "2025-02-18",
                    estado: "pendiente"
                });
                
                await db.collection('cancelaciones').doc('2').set({
                    id: 2,
                    alumno: "Paula Masquelet",
                    dia: "Jueves",
                    hora: "20:00",
                    fecha: "2025-02-20",
                    estado: "pendiente"
                });
                
                console.log('✅ Datos de prueba inicializados');
            }
        } catch (error) {
            console.error('Error al inicializar datos:', error);
        }
    },
    
    // Alumnos
    async obtenerAlumnos() {
        const snapshot = await db.collection('alumnos').get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    },
    
    async guardarAlumno(alumno) {
        if (alumno.id) {
            // Obtener email anterior por si cambió
            const docAnterior = await db.collection('alumnos').doc(alumno.id).get();
            const emailAnterior = docAnterior.exists ? docAnterior.data().email : null;
            
            await db.collection('alumnos').doc(alumno.id).set(alumno);
            
            // Si el email cambió, actualizar alumnos_autorizados
            if (emailAnterior && emailAnterior !== alumno.email) {
                // Borrar el viejo
                const viejoSnap = await db.collection('alumnos_autorizados').where('email', '==', emailAnterior).get();
                viejoSnap.forEach(doc => doc.ref.delete());
            }
            
            // Asegurar que el email actual esté en alumnos_autorizados
            const existeSnap = await db.collection('alumnos_autorizados').where('email', '==', alumno.email).get();
            if (existeSnap.empty) {
                await db.collection('alumnos_autorizados').add({ email: alumno.email });
            }
        } else {
            const docRef = await db.collection('alumnos').add(alumno);
            
            // Agregar a alumnos_autorizados
            const existeSnap = await db.collection('alumnos_autorizados').where('email', '==', alumno.email).get();
            if (existeSnap.empty) {
                await db.collection('alumnos_autorizados').add({ email: alumno.email });
            }
            
            return docRef.id;
        }
    },
    
    async eliminarAlumno(alumnoId) {
        // Obtener email antes de borrar
        const alumnoDoc = await db.collection('alumnos').doc(alumnoId).get();
        const email = alumnoDoc.exists ? alumnoDoc.data().email : null;
        
        // Eliminar alumno
        await db.collection('alumnos').doc(alumnoId).delete();
        
        // Eliminar de alumnos_autorizados
        if (email) {
            const autSnap = await db.collection('alumnos_autorizados').where('email', '==', email).get();
            autSnap.forEach(doc => doc.ref.delete());
        }
        
        // Eliminar sus cancelaciones
        const cancelaciones = await db.collection('cancelacionesAlumno').where('alumnoId', '==', alumnoId).get();
        const batch = db.batch();
        cancelaciones.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    },
    
    // Horarios
    async obtenerHorarios() {
        const doc = await db.collection('config').doc('horarios').get();
        return doc.exists ? doc.data() : {};
    },
    
    async guardarHorarios(horarios) {
        await db.collection('config').doc('horarios').set(horarios);
    },
    
    // Precios
    async obtenerPrecios() {
        const doc = await db.collection('config').doc('precios').get();
        return doc.exists ? doc.data() : {};
    },
    
    async guardarPrecios(precios) {
        await db.collection('config').doc('precios').set(precios);
    },
    
    // Cancelaciones
    async obtenerCancelaciones() {
        const snapshot = await db.collection('cancelaciones').get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    },
    
    async guardarCancelacion(cancelacion) {
        if (cancelacion.id) {
            await db.collection('cancelaciones').doc(cancelacion.id.toString()).set(cancelacion);
        } else {
            const snapshot = await db.collection('cancelaciones').get();
            const newId = snapshot.docs.length + 1;
            await db.collection('cancelaciones').doc(newId.toString()).set({...cancelacion, id: newId});
        }
    },
    
    async eliminarCancelacion(id) {
        await db.collection('cancelaciones').doc(id.toString()).delete();
    },
    
    // Cancelaciones específicas por alumno/fecha
    async obtenerCancelacionesAlumno(alumnoId) {
        const snapshot = await db.collection('cancelacionesAlumno').where('alumnoId', '==', alumnoId).get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    },
    
    async obtenerTodasCancelacionesAlumno() {
        const snapshot = await db.collection('cancelacionesAlumno').get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    },
    
    async guardarCancelacionAlumno(cancelacionAlumno) {
        const docRef = await db.collection('cancelacionesAlumno').add({
            ...cancelacionAlumno,
            fechaCreacion: new Date().toISOString()
        });
        return docRef.id;
    },
    
    async eliminarCancelacionAlumno(id) {
        await db.collection('cancelacionesAlumno').doc(id).delete();
    },
    
    // Solicitudes
    async obtenerSolicitudes() {
        const snapshot = await db.collection('solicitudes').get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    },
    
    async guardarSolicitud(solicitud) {
        if (solicitud.id) {
            // Actualizar documento existente
            await db.collection('solicitudes').doc(solicitud.id.toString()).set(solicitud, { merge: true });
        } else {
            // Crear nuevo documento
            const newDoc = await db.collection('solicitudes').add(solicitud);
            return newDoc.id;
        }
    },
    
    async eliminarSolicitud(id) {
        await db.collection('solicitudes').doc(id.toString()).delete();
    },
    
    // Recuperos (clases puntuales aprobadas)
    async obtenerRecuperos() {
        const snapshot = await db.collection('recuperos').get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    },
    
    async guardarRecupero(recupero) {
        const docRef = await db.collection('recuperos').add({
            ...recupero,
            fechaCreacion: new Date().toISOString()
        });
        return docRef.id;
    },
    
    async actualizarEstadoCancelacionAlumno(id, nuevoEstado) {
        await db.collection('cancelacionesAlumno').doc(id).update({ estado: nuevoEstado });
    },
    
    async resetearAlumno(alumnoId) {
        const batch = db.batch();
        
        // Borrar cancelacionesAlumno del alumno
        const cancelaciones = await db.collection('cancelacionesAlumno').where('alumnoId', '==', alumnoId).get();
        cancelaciones.docs.forEach(doc => batch.delete(doc.ref));
        
        // Borrar recuperos del alumno
        const recuperos = await db.collection('recuperos').where('alumnoId', '==', alumnoId).get();
        recuperos.docs.forEach(doc => batch.delete(doc.ref));
        
        // Borrar solicitudes del alumno
        const solicitudes = await db.collection('solicitudes').where('alumnoId', '==', alumnoId).get();
        solicitudes.docs.forEach(doc => batch.delete(doc.ref));
        
        await batch.commit();
        
        // Resetear contadores del alumno
        await db.collection('alumnos').doc(alumnoId).update({
            clasesPendientes: 0,
            clasesUsadas: 0
        });
    }
};

function App() {
    const [cargando, setCargando] = useState(true);
    const [userType, setUserType] = useState(null);
    const [usuarioActual, setUsuarioActual] = useState(null);
    const [authUser, setAuthUser] = useState(null);
    const [alumnos, setAlumnos] = useState([]);
    const [horarios, setHorarios] = useState({});
    const [precios, setPrecios] = useState({});
    const [cancelaciones, setCancelaciones] = useState([]);
    const [cancelacionesAlumno, setCancelacionesAlumno] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);
    const [recuperos, setRecuperos] = useState([]);
    
    // PASO 1: Detectar estado de autenticación (esto es lo ÚNICO que corre sin auth)
    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            console.log('🔑 Auth state changed:', user ? user.email : 'no user');
            setAuthUser(user);
            setCargando(false);
        });
        return () => unsubscribe();
    }, []);
    
    // PASO 2: Cuando hay usuario autenticado, arrancar TODOS los listeners
    useEffect(() => {
        if (!authUser) {
            // Si no hay user, limpiar todo
            setAlumnos([]);
            setHorarios({});
            setPrecios({});
            setCancelaciones([]);
            setCancelacionesAlumno([]);
            setSolicitudes([]);
            setRecuperos([]);
            return;
        }
        
        console.log('📡 Usuario autenticado, iniciando listeners...');
        
        const unsubscribers = [];
        
        // Listener: Alumnos
        unsubscribers.push(
            db.collection('alumnos').onSnapshot((snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('📬 Alumnos actualizados:', data.length);
                setAlumnos(data);
            }, (error) => {
                console.error('Error en listener de alumnos:', error);
            })
        );
        
        // Listener: Solicitudes
        unsubscribers.push(
            db.collection('solicitudes').onSnapshot((snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('📬 Solicitudes actualizadas:', data.length);
                setSolicitudes(data);
            }, (error) => {
                console.error('Error en listener de solicitudes:', error);
            })
        );
        
        // Listener: Recuperos
        unsubscribers.push(
            db.collection('recuperos').onSnapshot((snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('📬 Recuperos actualizados:', data.length);
                setRecuperos(data);
            }, (error) => {
                console.error('Error en listener de recuperos:', error);
            })
        );
        
        // Listener: Precios
        unsubscribers.push(
            db.collection('config').doc('precios').onSnapshot((doc) => {
                if (doc.exists) {
                    console.log('📬 Precios actualizados');
                    setPrecios(doc.data());
                }
            }, (error) => {
                console.error('Error en listener de precios:', error);
            })
        );
        
        // Listener: Horarios
        unsubscribers.push(
            db.collection('config').doc('horarios').onSnapshot((doc) => {
                if (doc.exists) {
                    console.log('📬 Horarios actualizados');
                    setHorarios(doc.data());
                }
            }, (error) => {
                console.error('Error en listener de horarios:', error);
            })
        );
        
        // Listener: CancelacionesAlumno
        unsubscribers.push(
            db.collection('cancelacionesAlumno').onSnapshot((snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('📬 CancelacionesAlumno actualizadas:', data.length);
                setCancelacionesAlumno(data);
            }, (error) => {
                console.error('Error en listener de cancelacionesAlumno:', error);
            })
        );
        
        // Listener: Cancelaciones
        unsubscribers.push(
            db.collection('cancelaciones').onSnapshot((snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCancelaciones(data);
            }, (error) => {
                console.error('Error en listener de cancelaciones:', error);
            })
        );
        
        // Cleanup: desuscribir todos los listeners
        return () => {
            console.log('🔌 Limpiando todos los listeners');
            unsubscribers.forEach(unsub => unsub());
        };
    }, [authUser]);
    
    // PASO 3: Cuando authUser cambia y tenemos alumnos, resolver vista
    // PASO 3: Resolver tipo de usuario según email
    useEffect(() => {
        if (!authUser) {
            setUserType(null);
            setUsuarioActual(null);
            return;
        }
        
        const email = authUser.email;
        if (email === 'marinapilatesestudio@gmail.com') {
            setUserType('admin');
        } else {
            setUserType('alumno');
            // Buscar perfil del alumno
            const alumno = alumnos.find(a => a.email === email);
            if (alumno) {
                setUsuarioActual(alumno);
            }
        }
    }, [authUser, alumnos]);
    
    // Actualizar usuarioActual cuando cambian los alumnos
    useEffect(() => {
        if (userType === 'alumno' && usuarioActual) {
            const alumnoActualizado = alumnos.find(a => a.email === usuarioActual.email);
            if (alumnoActualizado) {
                setUsuarioActual(alumnoActualizado);
            }
        }
    }, [alumnos]);
    
    const cargarDatos = async () => {
        try {
            const [horariosData, preciosData, cancelacionesData, solicitudesData, recuperosData] = await Promise.all([
                FirebaseService.obtenerHorarios(),
                FirebaseService.obtenerPrecios(),
                FirebaseService.obtenerCancelaciones(),
                FirebaseService.obtenerSolicitudes(),
                FirebaseService.obtenerRecuperos()
            ]);
            setHorarios(horariosData);
            setPrecios(preciosData);
            setCancelaciones(cancelacionesData);
            setSolicitudes(solicitudesData);
            setRecuperos(recuperosData);
        } catch (error) {
            console.error('Error al cargar datos:', error);
        }
    };
    
    const handleLogin = async (tipo, email) => {
        // PASO 3 se encarga de setear userType y vista via authUser
        // Este handler solo es fallback por si onAuthStateChanged no alcanza
        setUserType(tipo);
    };
    
    const handleLogout = () => {
        firebase.auth().signOut();
        setUserType(null);
        setUsuarioActual(null);
    };
    
    // ── RENDERIZADO basado en estado de auth ──
    
    if (cargando) {
        return (
            <div className="container">
                <div className="loading">
                    <LogoSVG width={200} style={{margin: '0 auto'}} />
                    <p>Cargando...</p>
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }
    
    // Sin usuario autenticado → Login
    if (!authUser) {
        return <LoginScreen onLogin={handleLogin} alumnos={alumnos} />;
    }
    
    // Admin autenticado
    if (userType === 'admin') {
        return <AdminDashboard 
            alumnos={alumnos} 
            setAlumnos={setAlumnos}
            horarios={horarios}
            setHorarios={setHorarios}
            precios={precios}
            setPrecios={setPrecios}
            cancelaciones={cancelaciones}
            setCancelaciones={setCancelaciones}
            cancelacionesAlumno={cancelacionesAlumno}
            solicitudes={solicitudes}
            setSolicitudes={setSolicitudes}
            recuperos={recuperos}
            onLogout={handleLogout}
            recargarDatos={cargarDatos}
        />;
    }
    
    // Alumno autenticado con datos cargados
    if (userType === 'alumno' && usuarioActual) {
        return <AlumnoDashboard 
            alumno={usuarioActual}
            alumnos={alumnos}
            horarios={horarios}
            precios={precios}
            cancelaciones={cancelaciones}
            setCancelaciones={setCancelaciones}
            cancelacionesAlumno={cancelacionesAlumno}
            setCancelacionesAlumno={setCancelacionesAlumno}
            solicitudes={solicitudes}
            recuperos={recuperos}
            onLogout={handleLogout}
            recargarDatos={cargarDatos}
        />;
    }
    
    // Estado transitorio: autenticado pero resolviendo tipo/datos
    return (
        <div className="container">
            <div className="loading">
                <LogoSVG width={200} style={{margin: '0 auto'}} />
                <p>Cargando datos...</p>
                <div className="spinner"></div>
            </div>
        </div>
    );
}

function LoginScreen({ onLogin, alumnos }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [exito, setExito] = useState('');
    const [cargando, setCargando] = useState(false);
    const [vista, setVista] = useState('login'); // 'login', 'resetPassword', 'activarCuenta'
    const [resetEmail, setResetEmail] = useState('');
    const [activarEmail, setActivarEmail] = useState('');
    const [mostrarPassword, setMostrarPassword] = useState(false);
    
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setCargando(true);
        
        try {
            const resultado = await firebase.auth().signInWithEmailAndPassword(email, password);
            const usuarioFirebase = resultado.user;
            
            let userType = 'alumno';
            if (email === 'marinapilatesestudio@gmail.com') {
                userType = 'admin';
            }
            
            // Si es alumno, marcar como activo en el primer login
            if (userType === 'alumno') {
                try {
                    const alumnoSnap = await db.collection('alumnos').where('email', '==', email).get();
                    if (!alumnoSnap.empty) {
                        const alumnoDoc = alumnoSnap.docs[0];
                        if (!alumnoDoc.data().activo) {
                            await alumnoDoc.ref.update({ activo: true });
                            console.log('✅ Alumno marcado como activo en primer login');
                        }
                    }
                } catch (err) {
                    console.error('Error al marcar activo:', err);
                }
            }
            
            onLogin(userType, email);
        } catch (error) {
            console.error('Error en login:', error.code, error.message);
            if (error.code === 'auth/user-not-found') {
                setError('Email no registrado. Si es tu primer ingreso, activá tu cuenta primero.');
            } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setError('Contraseña incorrecta');
            } else if (error.code === 'auth/invalid-email') {
                setError('Email inválido');
            } else {
                setError('Error al iniciar sesión. Intentá de nuevo.');
            }
        }
        setCargando(false);
    };
    
    const handleActivarCuenta = async (e) => {
        e.preventDefault();
        setError('');
        setExito('');
        setCargando(true);
        
        const emailNormalizado = activarEmail.trim().toLowerCase();
        
        try {
            // 1. Verificar que el email esté en alumnos_autorizados (colección pública de solo lectura)
            const autorizadoSnap = await db.collection('alumnos_autorizados').where('email', '==', emailNormalizado).get();
            
            if (autorizadoSnap.empty) {
                setError('❌ Este email no está autorizado. Contactá a Marina Pilates para que te registre.');
                setCargando(false);
                return;
            }
            
            // 2. Crear usuario temporal en Firebase Auth con contraseña random
            const passwordTemporal = crypto.randomUUID() + 'Aa1!';
            let userCredential;
            try {
                userCredential = await firebase.auth().createUserWithEmailAndPassword(emailNormalizado, passwordTemporal);
            } catch (createError) {
                if (createError.code === 'auth/email-already-in-use') {
                    // El usuario ya existe en Auth, enviar reset directamente
                    await firebase.auth().sendPasswordResetEmail(emailNormalizado);
                    setExito('📧 Ya tenés una cuenta creada. Te reenviamos el email para que definas tu contraseña. Revisá tu bandeja de entrada y spam.');
                    setCargando(false);
                    return;
                }
                throw createError;
            }
            
            // 3. Enviar email de reseteo de contraseña
            await firebase.auth().sendPasswordResetEmail(emailNormalizado);
            
            // 4. Cerrar la sesión temporal
            await firebase.auth().signOut();
            
            setExito('📧 ¡Listo! Te enviamos un email a ' + emailNormalizado + ' para que definas tu contraseña. Revisá tu bandeja de entrada y la carpeta de spam.');
            
        } catch (error) {
            console.error('Error al activar cuenta:', error);
            if (error.code === 'auth/invalid-email') {
                setError('El email ingresado no es válido.');
            } else {
                setError('Error al activar la cuenta. Intentá de nuevo o contactá a Marina Pilates.');
            }
        }
        setCargando(false);
    };
    
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setExito('');
        setCargando(true);
        
        try {
            await firebase.auth().sendPasswordResetEmail(resetEmail.trim().toLowerCase());
            setExito('📧 Email de recuperación enviado. Revisá tu bandeja de entrada o la carpeta de spam.');
        } catch (error) {
            console.error('Error al resetear:', error);
            if (error.code === 'auth/user-not-found') {
                setError('Este email no tiene cuenta activa. ¿Necesitás activar tu cuenta?');
            } else {
                setError('Error: ' + error.message);
            }
        }
        setCargando(false);
    };
    
    // ── Vista: Recuperar Contraseña ──
    if (vista === 'resetPassword') {
        return (
            <div style={{maxWidth: '400px', margin: '50px auto', background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'}}>
                <div style={{textAlign: 'center', marginBottom: '20px'}}>
                    <svg width="50" height="50" viewBox="0 0 100 100" style={{margin: '0 auto'}}>
                        <circle cx="50" cy="50" r="48" fill="#667eea" opacity="0.1" stroke="#667eea" strokeWidth="2"/>
                        <text x="50" y="65" fontSize="50" fontWeight="bold" textAnchor="middle" fill="#667eea" fontFamily="Arial">M</text>
                    </svg>
                </div>
                <h2 style={{textAlign: 'center', marginBottom: '30px', color: '#667eea'}}>
                    Recuperar Contraseña
                </h2>
                
                {error && <div className="alert alert-danger">{error}</div>}
                {exito && <div className="alert alert-success">{exito}</div>}
                
                {!exito && (
                    <form onSubmit={handleResetPassword}>
                        <div className="form-group">
                            <label>Email</label>
                            <input 
                                type="email"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                placeholder="tu@email.com"
                                required
                            />
                        </div>
                        
                        <button type="submit" className="btn btn-primary" style={{width: '100%'}} disabled={cargando}>
                            {cargando ? '⏳ Enviando...' : 'Enviar Link de Recuperación'}
                        </button>
                    </form>
                )}
                
                <button 
                    onClick={() => { setVista('login'); setError(''); setExito(''); setResetEmail(''); }}
                    className="btn btn-secondary" 
                    style={{width: '100%', marginTop: '10px'}}
                >
                    Volver al Login
                </button>
            </div>
        );
    }
    
    // ── Vista: Activar Cuenta ──
    if (vista === 'activarCuenta') {
        return (
            <div style={{maxWidth: '400px', margin: '50px auto', background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'}}>
                <div style={{textAlign: 'center', marginBottom: '20px'}}>
                    <svg width="50" height="50" viewBox="0 0 100 100" style={{margin: '0 auto'}}>
                        <circle cx="50" cy="50" r="48" fill="#667eea" opacity="0.1" stroke="#667eea" strokeWidth="2"/>
                        <text x="50" y="65" fontSize="50" fontWeight="bold" textAnchor="middle" fill="#667eea" fontFamily="Arial">M</text>
                    </svg>
                </div>
                <h2 style={{textAlign: 'center', marginBottom: '20px', color: '#667eea'}}>
                    Activar mi Cuenta
                </h2>
                
                <div style={{marginBottom: '20px', padding: '12px', background: '#d1ecf1', borderRadius: '8px', fontSize: '0.85rem', color: '#0c5460', lineHeight: '1.5'}}>
                    Ingresá el email con el que te registró la profesora. Te enviaremos un link para que definas tu contraseña.
                </div>
                
                {error && <div className="alert alert-danger">{error}</div>}
                {exito && <div className="alert alert-success">{exito}</div>}
                
                {!exito && (
                    <form onSubmit={handleActivarCuenta}>
                        <div className="form-group">
                            <label>Email</label>
                            <input 
                                type="email"
                                value={activarEmail}
                                onChange={(e) => setActivarEmail(e.target.value)}
                                placeholder="tu@email.com"
                                required
                            />
                        </div>
                        
                        <button type="submit" className="btn btn-primary" style={{width: '100%'}} disabled={cargando}>
                            {cargando ? '⏳ Verificando...' : 'Activar Cuenta'}
                        </button>
                    </form>
                )}
                
                <button 
                    onClick={() => { setVista('login'); setError(''); setExito(''); setActivarEmail(''); }}
                    className="btn btn-secondary" 
                    style={{width: '100%', marginTop: '10px'}}
                >
                    Volver al Login
                </button>
            </div>
        );
    }
    
    // ── Vista: Login principal ──
    return (
        <div style={{maxWidth: '400px', margin: '50px auto', background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'}}>
            <div style={{textAlign: 'center', marginBottom: '30px'}}>
                <LogoSVG width={200} style={{margin: '0 auto'}} />
            </div>
            
            {error && <div className="alert alert-danger">{error}</div>}
            
            <form onSubmit={handleLogin}>
                <div className="form-group">
                    <label>Email</label>
                    <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        required
                    />
                </div>
                
                <div className="form-group">
                    <label>Contraseña</label>
                    <div className="password-wrapper">
                        <input 
                            type={mostrarPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                        <button 
                            type="button"
                            className="password-toggle"
                            onClick={() => setMostrarPassword(!mostrarPassword)}
                            tabIndex={-1}
                        >
                            {mostrarPassword ? (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>) : (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>)}
                        </button>
                    </div>
                </div>
                
                <button type="submit" className="btn btn-primary" style={{width: '100%'}} disabled={cargando}>
                    {cargando ? '⏳ Ingresando...' : 'Ingresar'}
                </button>
            </form>
            
            <div style={{marginTop: '20px', textAlign: 'center'}}>
                <button 
                    onClick={() => { setVista('resetPassword'); setError(''); }}
                    style={{background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem'}}
                >
                    ¿Olvidaste tu contraseña?
                </button>
            </div>
            
            <div style={{marginTop: '20px', padding: '15px', background: '#f0f7ff', borderRadius: '8px', fontSize: '0.85rem', color: '#0c5060', textAlign: 'center'}}>
                <strong>¿Primer ingreso?</strong><br/>
                <span style={{display: 'block', marginTop: '6px', marginBottom: '10px'}}>Si la profesora ya te registró, activá tu cuenta para recibir un email y crear tu contraseña.</span>
                <button 
                    onClick={() => { setVista('activarCuenta'); setError(''); }}
                    className="btn btn-success"
                    style={{fontSize: '0.9rem', padding: '10px 20px'}}
                >
                    Activar mi Cuenta
                </button>
            </div>
        </div>
    );
}

function AdminDashboard({ alumnos, setAlumnos, horarios, setHorarios, precios, setPrecios, cancelaciones, setCancelaciones, cancelacionesAlumno, solicitudes, setSolicitudes, recuperos, onLogout, recargarDatos }) {
    const [tabActiva, setTabActiva] = useState('cancelaciones');
    const [guardando, setGuardando] = useState(false);
    const [menuAbierto, setMenuAbierto] = useState(false);
    
    const guardarCambios = async (tipo, datos) => {
        try {
            setGuardando(true);
            if (tipo === 'alumno') {
                await FirebaseService.guardarAlumno(datos);
            } else if (tipo === 'horarios') {
                await FirebaseService.guardarHorarios(datos);
            } else if (tipo === 'precios') {
                await FirebaseService.guardarPrecios(datos);
            }
            // Los listeners en tiempo real se encargan de actualizar automáticamente
            alert('✅ Cambios guardados en Firebase');
        } catch (error) {
            console.error('Error al guardar:', error);
            alert('❌ Error al guardar. Verifica la consola.');
        } finally {
            setGuardando(false);
        }
    };
    
    return (
        <div className="container">
            <div className="header">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                        {/* Botón Hamburguesa */}
                        <button 
                            onClick={() => setMenuAbierto(!menuAbierto)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                padding: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                gap: '5px',
                                width: '40px',
                                height: '40px',
                                position: 'relative'
                            }}
                            title="Menú"
                        >
                            <span style={{width: '24px', height: '3px', background: 'white', borderRadius: '2px', transition: 'all 0.3s'}}></span>
                            <span style={{width: '24px', height: '3px', background: 'white', borderRadius: '2px', transition: 'all 0.3s'}}></span>
                            <span style={{width: '24px', height: '3px', background: 'white', borderRadius: '2px', transition: 'all 0.3s'}}></span>
                        </button>
                        
                        <span style={{fontSize: '1.1rem', fontWeight: '600', color: 'white'}}>
                            Panel Admin
                        </span>
                        {guardando && <span style={{marginLeft: '8px', fontSize: '0.8rem', opacity: 0.8, color: 'white'}}>💾 Guardando...</span>}
                    </div>
                    <HeaderLogoSVG width={120} style={{filter: 'brightness(0) invert(1)', opacity: 0.9}} />
                </div>
            </div>
            
            {/* MENÚ DESPLEGABLE */}
            {menuAbierto && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    zIndex: 999
                }} onClick={() => setMenuAbierto(false)}>
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '280px',
                        height: '100vh',
                        background: 'white',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column'
                    }} onClick={(e) => e.stopPropagation()}>
                        {/* Header del menú */}
                        <div style={{
                            padding: '20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            minHeight: '60px'
                        }}>
                            <span style={{fontSize: '1.2rem', fontWeight: 'bold'}}>Menú</span>
                            <button 
                                onClick={() => setMenuAbierto(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >×</button>
                        </div>
                        
                        {/* Items del menú */}
                        <div style={{flex: 1, padding: '0'}}>
                            {[
                                { id: 'calendario', icon: '📆', label: 'Calendario', color: '#667eea' },
                                { id: 'cancelaciones', icon: '◎', label: 'Solicitudes de Recupero', count: solicitudes.filter(s => s.estado === 'pendiente').length, color: '#007bff' },
                                { id: 'alumnos', icon: '◉', label: 'Alumnos', color: '#6c757d' },
                                { id: 'horarios', icon: '⏱', label: 'Horarios', color: '#28a745' },
                                { id: 'precios', icon: '◇', label: 'Precios', color: '#ffc107' },
                                { id: 'resumen', icon: '▨', label: 'Resumen del Mes', color: '#dc3545' },
                            ].map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setTabActiva(item.id);
                                        setMenuAbierto(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '16px 20px',
                                        border: 'none',
                                        background: tabActiva === item.id ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                                        borderLeft: tabActiva === item.id ? `4px solid #667eea` : '4px solid transparent',
                                        color: tabActiva === item.id ? '#667eea' : '#333',
                                        cursor: 'pointer',
                                        fontSize: '1.05rem',
                                        fontWeight: tabActiva === item.id ? '600' : '500',
                                        textAlign: 'left',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        borderBottom: '1px solid #f0f0f0'
                                    }}
                                    onMouseEnter={(e) => !tabActiva === item.id && (e.target.style.background = 'rgba(0,0,0,0.03)')}
                                    onMouseLeave={(e) => !tabActiva === item.id && (e.target.style.background = 'transparent')}
                                >
                                    <span style={{fontSize: '1.3rem'}}>{item.icon}</span>
                                    <span style={{flex: 1}}>{item.label}</span>
                                    {item.count > 0 && (
                                        <span style={{
                                            background: '#dc3545',
                                            color: 'white',
                                            borderRadius: '12px',
                                            padding: '2px 8px',
                                            fontSize: '0.8rem',
                                            fontWeight: 'bold',
                                            minWidth: '24px',
                                            textAlign: 'center'
                                        }}>
                                            {item.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        
                        {/* Footer del menú */}
                        <div style={{
                            padding: '20px',
                            borderTop: '2px solid #f0f0f0',
                            background: '#f8f9fa'
                        }}>
                            <button 
                                onClick={() => {
                                    onLogout();
                                    setMenuAbierto(false);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    background: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#c82333'}
                                onMouseLeave={(e) => e.target.style.background = '#dc3545'}
                            >
                                → Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="tabs">
                <button className={`tab ${tabActiva === 'calendario' ? 'active' : ''}`} onClick={() => setTabActiva('calendario')}>
                    <span className="tab-icon">📆</span> <span>Calendario</span>
                </button>
                <button className={`tab ${tabActiva === 'cancelaciones' ? 'active' : ''}`} onClick={() => setTabActiva('cancelaciones')}>
                    <span className="tab-icon">◎</span> <span>Solicitudes {solicitudes.filter(s => s.estado === 'pendiente').length > 0 && `(${solicitudes.filter(s => s.estado === 'pendiente').length})`}</span>
                </button>
                <button className={`tab ${tabActiva === 'alumnos' ? 'active' : ''}`} onClick={() => setTabActiva('alumnos')}>
                    <span className="tab-icon">◉</span> <span>Alumnos</span>
                </button>
                <button className={`tab ${tabActiva === 'horarios' ? 'active' : ''}`} onClick={() => setTabActiva('horarios')}>
                    <span className="tab-icon">⏱</span> <span>Horarios</span>
                </button>
                <button className={`tab ${tabActiva === 'precios' ? 'active' : ''}`} onClick={() => setTabActiva('precios')}>
                    <span className="tab-icon">◇</span> <span>Precios</span>
                </button>
                <button className={`tab ${tabActiva === 'resumen' ? 'active' : ''}`} onClick={() => setTabActiva('resumen')}>
                    <span className="tab-icon">▨</span> <span>Resumen</span>
                </button>
            </div>
            
            <div className="content">
                {tabActiva === 'calendario' && <CalendarioAdminTab alumnos={alumnos} cancelacionesAlumno={cancelacionesAlumno} horarios={horarios} recuperos={recuperos} />}
                {tabActiva === 'cancelaciones' && <SolicitudesTab solicitudes={solicitudes} alumnos={alumnos} recargarDatos={recargarDatos} />}
                {tabActiva === 'alumnos' && <AlumnosTab alumnos={alumnos} precios={precios} horarios={horarios} guardarCambios={guardarCambios} recargarDatos={recargarDatos} />}
                {tabActiva === 'horarios' && <HorariosTab horarios={horarios} alumnos={alumnos} guardarCambios={guardarCambios} />}
                {tabActiva === 'precios' && <PreciosTab precios={precios} guardarCambios={guardarCambios} />}
                {tabActiva === 'resumen' && <ResumenTab alumnos={alumnos} cancelaciones={cancelaciones} />}
            </div>
            
            <div className="footer">
                <button onClick={onLogout} className="btn btn-secondary">
                    Cerrar Sesión
                </button>
            </div>
        </div>
    );
}

function CalendarioAdminTab({ alumnos, cancelacionesAlumno, horarios, recuperos }) {
    const [semanaSeleccionada, setSemanaSeleccionada] = useState(new Date());
    
    const obtenerNombreCorto = (alumno) => {
        if (!alumno) return '';
        const apellidoInicial = alumno.apellido ? alumno.apellido[0] : '';
        return `${alumno.nombre} ${apellidoInicial}.`;
    };
    
    const obtenerAlumnosEnHorario = (fecha, hora) => {
        const fechaStr = fechaLocal(fecha);
        const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fecha.getDay()];
        
        // Alumnos con horario recurrente que no cancelaron
        const regulares = alumnos.filter(alumno => {
            if (!(alumno.horariosAsignados || []).includes(`${diaSemana}-${hora}`)) return false;
            const estaCancelada = cancelacionesAlumno.some(c => 
                c.alumnoId === alumno.id && c.fecha === fechaStr && c.hora === hora
            );
            return !estaCancelada;
        });
        
        // Alumnos con recupero aprobado para esta fecha/hora
        const conRecupero = (recuperos || [])
            .filter(r => r.fecha === fechaStr && r.hora === hora && r.estado === 'aprobado')
            .map(r => ({ id: r.alumnoId, nombre: r.alumnoNombre?.split(' ')[0] || '', apellido: r.alumnoNombre?.split(' ')[1] || '', esRecupero: true }));
        
        return [...regulares, ...conRecupero];
    };
    
    const obtenerCancelacionesEnHorario = (fecha, hora) => {
        const fechaStr = fechaLocal(fecha);
        return cancelacionesAlumno.filter(c => c.fecha === fechaStr && c.hora === hora);
    };
    
    const obtenerDiasDeSemanConClases = () => {
        const diasSemana = [];
        const primerDia = new Date(semanaSeleccionada);
        // Arrancar en lunes
        const dia = primerDia.getDay();
        const diffLunes = dia === 0 ? -6 : 1 - dia;
        primerDia.setDate(primerDia.getDate() + diffLunes);
        
        for (let i = 0; i < 7; i++) {
            const fecha = new Date(primerDia);
            fecha.setDate(fecha.getDate() + i);
            diasSemana.push(fecha);
        }
        return diasSemana;
    };
    
    const obtenerHorariosConClasesEnFecha = (fecha) => {
        const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fecha.getDay()];
        const horariosDelDia = [...new Set(
            alumnos
                .filter(a => (a.horariosAsignados || []).some(h => h.split('-')[0] === diaSemana))
                .flatMap(a => (a.horariosAsignados || []).filter(h => h.split('-')[0] === diaSemana).map(h => h.split('-')[1]))
        )].sort();
        return horariosDelDia;
    };
    
    const diasSemana = obtenerDiasDeSemanConClases();
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const diasSemanaAbrev = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    // Obtener todos los horarios con clases en la semana (incluyendo recuperos)
    const horariosEnSemana = [...new Set([
        ...diasSemana.flatMap(fecha => obtenerHorariosConClasesEnFecha(fecha)),
        ...(recuperos || [])
            .filter(r => r.estado === 'aprobado' && diasSemana.some(f => fechaLocal(f) === r.fecha))
            .map(r => r.hora)
    ])].sort();
    
    if (horariosEnSemana.length === 0) {
        return (
            <div>
                <h2 style={{marginBottom: '20px'}}>Calendario - Semana de {diasSemana[0].getDate()} al {diasSemana[6].getDate()} de {meses[semanaSeleccionada.getMonth()]}</h2>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
                    <button className="btn btn-secondary" onClick={() => setSemanaSeleccionada(new Date(semanaSeleccionada.getTime() - 7 * 24 * 60 * 60 * 1000))}>← Semana Anterior</button>
                    <button className="btn btn-secondary" onClick={() => setSemanaSeleccionada(new Date())}>Hoy</button>
                    <button className="btn btn-secondary" onClick={() => setSemanaSeleccionada(new Date(semanaSeleccionada.getTime() + 7 * 24 * 60 * 60 * 1000))}>Semana Siguiente →</button>
                </div>
                <div className="alert alert-info">No hay clases programadas esta semana.</div>
            </div>
        );
    }
    
    return (
        <div>
            <h2 style={{marginBottom: '20px'}}>Calendario - Semana de {diasSemana[0].getDate()} al {diasSemana[6].getDate()} de {meses[semanaSeleccionada.getMonth()]}</h2>
            
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
                <button className="btn btn-secondary" onClick={() => setSemanaSeleccionada(new Date(semanaSeleccionada.getTime() - 7 * 24 * 60 * 60 * 1000))}>
                    ← Semana Anterior
                </button>
                <button className="btn btn-secondary" onClick={() => setSemanaSeleccionada(new Date())}>
                    Hoy
                </button>
                <button className="btn btn-secondary" onClick={() => setSemanaSeleccionada(new Date(semanaSeleccionada.getTime() + 7 * 24 * 60 * 60 * 1000))}>
                    Semana Siguiente →
                </button>
            </div>
            
            <div className="table-responsive">
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem'}}>
                    <thead>
                        <tr style={{background: '#667eea', color: 'white'}}>
                            <th style={{padding: '10px', border: '1px solid #dee2e6', textAlign: 'left'}}>Hora</th>
                            {diasSemana.map((fecha, i) => (
                                <th key={i} style={{padding: '10px', border: '1px solid #dee2e6', textAlign: 'center', minWidth: '120px'}}>
                                    {diasSemanaAbrev[fecha.getDay()]} {fecha.getDate()}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {horariosEnSemana.map(hora => (
                            <tr key={hora}>
                                <td style={{padding: '10px', border: '1px solid #dee2e6', fontWeight: 'bold', background: '#f8f9fa'}}>
                                    {hora}
                                </td>
                                {diasSemana.map((fecha, i) => {
                                    const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fecha.getDay()];
                                    const tieneHorarioEnDia = alumnos.some(a => (a.horariosAsignados || []).includes(`${diaSemana}-${hora}`)) ||
                                        (recuperos || []).some(r => r.fecha === fechaLocal(fecha) && r.hora === hora && r.estado === 'aprobado');
                                    
                                    if (!tieneHorarioEnDia) {
                                        return <td key={i} style={{padding: '10px', border: '1px solid #dee2e6', background: '#f5f5f5'}}></td>;
                                    }
                                    
                                    const alumnosHoy = obtenerAlumnosEnHorario(fecha, hora);
                                    const cancelacionesHoy = obtenerCancelacionesEnHorario(fecha, hora);
                                    const ocupados = alumnosHoy.length;
                                    const libres = 5 - ocupados;
                                    
                                    return (
                                        <td key={i} style={{padding: '10px', border: '1px solid #dee2e6', verticalAlign: 'top', background: cancelacionesHoy.length > 0 ? '#f0f0f0' : 'white'}}>
                                            <div style={{fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '5px', color: libres > 0 ? '#28a745' : '#dc3545'}}>
                                                {libres} lugar{libres !== 1 ? 'es' : ''}
                                            </div>
                                            <div style={{marginBottom: '5px'}}>
                                                {alumnosHoy.map((alumno, idx) => (
                                                    <div key={idx} style={{fontSize: '0.7rem', padding: '2px', background: alumno.esRecupero ? '#28a745' : '#667eea', color: 'white', borderRadius: '3px', marginBottom: '2px'}}>
                                                        {alumno.esRecupero ? '🔄 ' : ''}{obtenerNombreCorto(alumno)}
                                                    </div>
                                                ))}
                                            </div>
                                            {cancelacionesHoy.length > 0 && (
                                                <div>
                                                    <div style={{fontSize: '0.7rem', fontWeight: 'bold', color: '#ff9800', marginBottom: '3px'}}>Canceladas:</div>
                                                    {cancelacionesHoy.map((c, idx) => (
                                                        <div key={idx} style={{fontSize: '0.7rem', padding: '2px', background: '#ccc', color: '#666', borderRadius: '3px', marginBottom: '2px', textDecoration: 'line-through'}}>
                                                            {c.alumnoNombre}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ResumenTab({ alumnos, cancelaciones }) {
    const [modalPlan, setModalPlan] = useState(null);
    
    const totalAlumnos = alumnos.length;
    const alumnosActivos = alumnos.filter(a => a.activo && a.clasesUsadas > 0).length;
    const totalClasesDelMes = alumnos.reduce((sum, a) => sum + a.clasesUsadas, 0);
    const recuperacionesPendientes = cancelaciones.length;
    
    const alumnosPorPlan = (plan) => alumnos.filter(a => a.abono === plan);
    
    return (
        <div>
            <h2 style={{marginBottom: '20px'}}>Resumen del Mes</h2>
            <div className="grid">
                <div className="stat-card">
                    <div className="stat-number">{totalAlumnos}</div>
                    <div className="stat-label">Total Alumnos</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{alumnosActivos}</div>
                    <div className="stat-label">Alumnos Activos</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{totalClasesDelMes}</div>
                    <div className="stat-label">Clases Dictadas</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{recuperacionesPendientes}</div>
                    <div className="stat-label">Cancelaciones Pendientes</div>
                </div>
            </div>
            
            <h3 style={{marginTop: '40px', marginBottom: '20px'}}>Distribución por Plan (Click para ver detalle)</h3>
            <div className="grid">
                {['1x_semana', '2x_semana', '3x_semana', '4x_semana'].map(plan => {
                    const cantidad = alumnos.filter(a => a.abono === plan).length;
                    return (
                        <div key={plan} className="card clickable" onClick={() => setModalPlan(plan)}>
                            <h3>{plan.replace('_', ' ').toUpperCase()}</h3>
                            <div style={{fontSize: '2rem', fontWeight: 'bold', color: '#667eea', textAlign: 'center', marginTop: '10px'}}>
                                {cantidad}
                            </div>
                            <div style={{textAlign: 'center', color: '#6c757d'}}>
                                alumnos
                            </div>
                            <div style={{textAlign: 'center', marginTop: '10px', fontSize: '0.9rem', color: '#667eea'}}>
                                👆 Click para ver lista
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {modalPlan && (
                <Modal onClose={() => setModalPlan(null)}>
                    <h2>Alumnos con plan {modalPlan.replace('_', ' ').toUpperCase()}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Clases</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alumnosPorPlan(modalPlan).map(a => (
                                <tr key={a.id}>
                                    <td>{a.nombre} {a.apellido}</td>
                                    <td>{a.email}</td>
                                    <td>{a.clasesUsadas}/{a.clasesTotales}</td>
                                    <td>
                                        <span className={`badge ${a.activo ? 'badge-success' : 'badge-danger'}`}>
                                            {a.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Modal>
            )}
        </div>
    );
}

function AlumnosTab({ alumnos, precios, horarios, guardarCambios, recargarDatos }) {
    const [filtro, setFiltro] = useState('todos');
    const [busqueda, setBusqueda] = useState('');
    const [vistaLista, setVistaLista] = useState(false);
    const [alumnoEditando, setAlumnoEditando] = useState(null);
    const [mostrarNuevo, setMostrarNuevo] = useState(false);
    const [reseteando, setReseteando] = useState(null);
    
    const handleResetear = async (alumno) => {
        if (!window.confirm(`¿Resetear el historial de ${alumno.nombre} ${alumno.apellido}?\n\nEsto borrará todas sus cancelaciones, recuperos y solicitudes pendientes, y pondrá sus contadores en cero.`)) return;
        setReseteando(alumno.id);
        try {
            await FirebaseService.resetearAlumno(alumno.id);
            // Los listeners se encargan de actualizar automáticamente
            alert(`✅ Historial de ${alumno.nombre} reseteado`);
        } catch(e) {
            console.error(e);
            alert('❌ Error al resetear. Revisá la consola.');
        } finally {
            setReseteando(null);
        }
    };
    
    const alumnosFiltrados = alumnos
        .filter(a => filtro === 'todos' || a.abono === filtro)
        .filter(a => {
            if (!busqueda) return true;
            const q = busqueda.toLowerCase();
            return (a.nombre + ' ' + a.apellido).toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
        })
        .sort((a, b) => (a.apellido + a.nombre).localeCompare(b.apellido + b.nombre));
    
    
    return (
        <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px'}}>
                <h2>Gestión de Alumnos <span style={{fontSize: '1rem', color: '#6c757d', fontWeight: 'normal'}}>({alumnosFiltrados.length})</span></h2>
                <button className="btn btn-primary" onClick={() => setMostrarNuevo(true)}>
                    + Nuevo Alumno
                </button>
            </div>
            
            {/* Barra de filtros */}
            <div style={{display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center'}}>
                <input
                    type="text"
                    placeholder="🔍 Buscar por nombre o email..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '2px solid #e9ecef', fontSize: '0.95rem'}}
                />
                <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{padding: '10px', borderRadius: '8px', border: '2px solid #e9ecef'}}>
                    <option value="todos">Todos los planes</option>
                    <option value="1x_semana">1x Semana</option>
                    <option value="2x_semana">2x Semana</option>
                    <option value="3x_semana">3x Semana</option>
                    <option value="4x_semana">4x Semana</option>
                </select>
                {/* Toggle vista */}
                <div style={{display: 'flex', border: '2px solid #e9ecef', borderRadius: '8px', overflow: 'hidden'}}>
                    <button
                        onClick={() => setVistaLista(false)}
                        style={{padding: '10px 16px', border: 'none', cursor: 'pointer', background: !vistaLista ? '#667eea' : 'white', color: !vistaLista ? 'white' : '#6c757d', fontWeight: 600, fontSize: '1rem'}}
                        title="Vista tarjetas"
                    >⊞</button>
                    <button
                        onClick={() => setVistaLista(true)}
                        style={{padding: '10px 16px', border: 'none', cursor: 'pointer', background: vistaLista ? '#667eea' : 'white', color: vistaLista ? 'white' : '#6c757d', fontWeight: 600, fontSize: '1rem'}}
                        title="Vista lista"
                    >☰</button>
                </div>
            </div>
            
            {/* VISTA TARJETAS */}
            {!vistaLista && (
                <div className="grid">
                    {alumnosFiltrados.map(alumno => (
                        <div key={alumno.id} className="card">
                            <h3 style={{marginBottom: '8px'}}>{alumno.nombre} {alumno.apellido}</h3>
                            <div style={{marginBottom: '8px'}}>
                                <span className={`badge ${alumno.activo ? 'badge-success' : 'badge-danger'}`}>
                                    {alumno.activo ? 'Activo' : 'Inactivo'}
                                </span>
                                <span className="badge badge-info" style={{marginLeft: '5px'}}>{alumno.abono.replace('_', ' ')}</span>
                            </div>
                            <div className="info-row">
                                <span className="label">Email:</span>
                                <span className="value" style={{fontSize: '0.85rem'}}>{alumno.email}</span>
                            </div>
                            <div className="info-row">
                                <span className="label">Clases:</span>
                                <span className="value">{alumno.clasesUsadas}/{alumno.clasesTotales}</span>
                            </div>
                            {alumno.clasesPendientes > 0 && (
                                <div className="info-row">
                                    <span className="label">Pendientes:</span>
                                    <span className="badge badge-warning">{alumno.clasesPendientes} a recuperar</span>
                                </div>
                            )}
                            <div style={{marginTop: '10px', fontSize: '0.8rem', color: '#6c757d'}}>
                                {(alumno.horariosAsignados || []).map(h => (
                                    <span key={h} style={{display: 'inline-block', background: '#e9ecef', borderRadius: '4px', padding: '2px 6px', margin: '2px', fontSize: '0.75rem'}}>{h.replace('-', ' ')}</span>
                                ))}
                            </div>
                            <button className="btn btn-primary" style={{width: '100%', marginTop: '12px'}} onClick={() => setAlumnoEditando(alumno)}>
                                ✎ Editar
                            </button>
                            <button 
                                className="btn btn-danger" 
                                style={{width: '100%', marginTop: '6px', fontSize: '0.85rem', padding: '8px'}} 
                                onClick={() => handleResetear(alumno)}
                                disabled={reseteando === alumno.id}
                            >
                                {reseteando === alumno.id ? '⏳ Reseteando...' : '↻ Resetear historial'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
            
            {/* VISTA LISTA */}
            {vistaLista && (
                <div style={{overflowX: 'auto'}}>
                    <table>
                        <thead>
                            <tr>
                                <th>Alumno</th>
                                <th>Email</th>
                                <th>Plan</th>
                                <th>Clases</th>
                                <th>Horarios</th>
                                <th>Estado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {alumnosFiltrados.map(alumno => (
                                <tr key={alumno.id}>
                                    <td style={{fontWeight: 600}}>{alumno.apellido}, {alumno.nombre}</td>
                                    <td style={{fontSize: '0.85rem', color: '#6c757d'}}>{alumno.email}</td>
                                    <td><span className="badge badge-info">{alumno.abono.replace('_', ' ')}</span></td>
                                    <td>
                                        <span style={{fontWeight: 600}}>{alumno.clasesUsadas}/{alumno.clasesTotales}</span>
                                        {alumno.clasesPendientes > 0 && <span className="badge badge-warning" style={{marginLeft: '5px'}}>{alumno.clasesPendientes} pend.</span>}
                                    </td>
                                    <td style={{fontSize: '0.8rem', color: '#6c757d', maxWidth: '200px'}}>
                                        {(alumno.horariosAsignados || []).join(' · ')}
                                    </td>
                                    <td>
                                        <span className={`badge ${alumno.activo ? 'badge-success' : 'badge-danger'}`}>
                                            {alumno.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-primary" style={{padding: '6px 14px', fontSize: '0.85rem'}} onClick={() => setAlumnoEditando(alumno)}>
                                            ✎ Editar
                                        </button>
                                        <button 
                                            className="btn btn-danger" 
                                            style={{padding: '6px 10px', fontSize: '0.85rem', marginLeft: '5px'}} 
                                            onClick={() => handleResetear(alumno)}
                                            disabled={reseteando === alumno.id}
                                            title="Resetear historial"
                                        >
                                            {reseteando === alumno.id ? '⏳' : '🔄'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            {alumnosFiltrados.length === 0 && (
                <div className="alert alert-info">No se encontraron alumnos con ese criterio.</div>
            )}
            
            {alumnoEditando && (
                <FormularioAlumno 
                    alumno={alumnoEditando}
                    horarios={horarios}
                    onClose={() => setAlumnoEditando(null)}
                    onSave={async (alumnoActualizado) => {
                        await guardarCambios('alumno', alumnoActualizado);
                        setAlumnoEditando(null);
                    }}
                    precios={precios}
                />
            )}
            
            {mostrarNuevo && (
                <FormularioAlumno 
                    alumno={null}
                    horarios={horarios}
                    onClose={() => setMostrarNuevo(false)}
                    onSave={async (nuevoAlumno) => {
                        const maxId = Math.max(...alumnos.map(a => parseInt(a.id)), 0) + 1;
                        await guardarCambios('alumno', {...nuevoAlumno, id: maxId.toString()});
                        setMostrarNuevo(false);
                    }}
                    precios={precios}
                />
            )}
        </div>
    );
}

function FormularioAlumno({ alumno, onClose, onSave, precios, horarios }) {
    const [datos, setDatos] = useState(alumno || {
        nombre: '',
        apellido: '',
        email: '',
        abono: '2x_semana',
        clasesTotales: 8,
        clasesUsadas: 0,
        clasesPendientes: 0,
        horariosAsignados: [],
        activo: true
    });
    
    const clasesMap = {
        '1x_semana': 4,
        '2x_semana': 8,
        '3x_semana': 12,
        '4x_semana': 16
    };
    
    const handlePlanChange = (plan) => {
        setDatos({...datos, abono: plan, clasesTotales: clasesMap[plan]});
    };
    
    const toggleHorario = (dia, hora) => {
        const clave = `${dia}-${hora}`;
        const actuales = datos.horariosAsignados || [];
        if (actuales.includes(clave)) {
            setDatos({...datos, horariosAsignados: actuales.filter(h => h !== clave)});
        } else {
            setDatos({...datos, horariosAsignados: [...actuales, clave]});
        }
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(datos);
    };
    
    const handleEliminar = async () => {
        if (!window.confirm(`⚠️ ¿ELIMINAR a ${datos.nombre} ${datos.apellido}?\n\nEsto borrará permanentemente al alumno, sus horarios se liberarán y no se podrá recuperar la información.\n\nEscribí "ELIMINAR" para confirmar.`)) return;
        
        const respuesta = prompt('Escribe "ELIMINAR" para confirmar:');
        if (respuesta !== 'ELIMINAR') {
            alert('❌ Cancelado. No se eliminó nada.');
            return;
        }
        
        try {
            await FirebaseService.eliminarAlumno(datos.id);
            alert(`✅ ${datos.nombre} ${datos.apellido} ha sido eliminado permanentemente.`);
            onClose();
        } catch (error) {
            console.error('Error al eliminar:', error);
            alert('❌ Error al eliminar. Verifica la consola.');
        }
    };
    
    const diasOrden = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const diasConHorarios = diasOrden.filter(d => horarios[d] && horarios[d].length > 0);
    
    return (
        <Modal onClose={onClose}>
            <h2>{alumno ? 'Editar Alumno' : 'Nuevo Alumno'}</h2>
            <form onSubmit={handleSubmit}>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                    <div className="form-group">
                        <label>Nombre</label>
                        <input value={datos.nombre} onChange={(e) => setDatos({...datos, nombre: e.target.value})} required />
                    </div>
                    <div className="form-group">
                        <label>Apellido</label>
                        <input value={datos.apellido} onChange={(e) => setDatos({...datos, apellido: e.target.value})} required />
                    </div>
                </div>
                
                <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={datos.email} onChange={(e) => setDatos({...datos, email: e.target.value})} required />
                </div>
                
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                    <div className="form-group">
                        <label>Plan</label>
                        <select value={datos.abono} onChange={(e) => handlePlanChange(e.target.value)}>
                            <option value="1x_semana">1x Semana — ${precios['1x_semana']?.toLocaleString()}</option>
                            <option value="2x_semana">2x Semana — ${precios['2x_semana']?.toLocaleString()}</option>
                            <option value="3x_semana">3x Semana — ${precios['3x_semana']?.toLocaleString()}</option>
                            <option value="4x_semana">4x Semana — ${precios['4x_semana']?.toLocaleString()}</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Clases usadas este mes</label>
                        <input type="number" min="0" value={datos.clasesUsadas} onChange={(e) => setDatos({...datos, clasesUsadas: parseInt(e.target.value) || 0})} />
                    </div>
                </div>
                
                {/* Selector de horarios */}
                <div className="form-group">
                    <label style={{marginBottom: '10px', display: 'block'}}>
                        Días y horarios asignados
                        <span style={{fontWeight: 'normal', color: '#6c757d', marginLeft: '8px', fontSize: '0.85rem'}}>
                            ({(datos.horariosAsignados || []).length} seleccionados)
                        </span>
                    </label>
                    
                    {diasConHorarios.length === 0 && (
                        <div className="alert alert-info">No hay horarios configurados. Configurá los horarios primero en la pestaña "Horarios".</div>
                    )}
                    
                    <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                        {diasConHorarios.map(dia => (
                            <div key={dia}>
                                <div style={{fontWeight: 600, color: '#495057', marginBottom: '6px', fontSize: '0.9rem'}}>{dia}</div>
                                <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                                    {horarios[dia].map(hora => {
                                        const clave = `${dia}-${hora}`;
                                        const seleccionado = (datos.horariosAsignados || []).includes(clave);
                                        return (
                                            <button
                                                key={hora}
                                                type="button"
                                                onClick={() => toggleHorario(dia, hora)}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    border: `2px solid ${seleccionado ? '#667eea' : '#dee2e6'}`,
                                                    background: seleccionado ? '#667eea' : 'white',
                                                    color: seleccionado ? 'white' : '#495057',
                                                    cursor: 'pointer',
                                                    fontWeight: seleccionado ? 700 : 400,
                                                    fontSize: '0.9rem',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {seleccionado ? '✓ ' : ''}{hora}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="form-group">
                    <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                        <input type="checkbox" checked={datos.activo} onChange={(e) => setDatos({...datos, activo: e.target.checked})} style={{width: 'auto'}} />
                        Alumno Activo
                    </label>
                </div>
                
                <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                    <button type="submit" className="btn btn-primary" style={{flex: 1}}>
                        ↓ Guardar
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={onClose} style={{flex: 1}}>
                        Cancelar
                    </button>
                    {alumno && (
                        <button type="button" className="btn btn-danger" onClick={handleEliminar} style={{flex: 1}}>
                            ✗ Eliminar
                        </button>
                    )}
                </div>
            </form>
        </Modal>
    );
}

function HorariosTab({ horarios, alumnos, guardarCambios }) {
    const [editando, setEditando] = useState(false);
    const [horariosTemp, setHorariosTemp] = useState({...horarios});
    
    // Actualizar horariosTemp cuando cambia horarios (listener)
    useEffect(() => {
        if (!editando) {
            setHorariosTemp({...horarios});
        }
    }, [horarios, editando]);
    
    const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    
    const agregarHorario = (dia, hora) => {
        const nuevosHorarios = {...horariosTemp};
        if (!nuevosHorarios[dia]) nuevosHorarios[dia] = [];
        if (!nuevosHorarios[dia].includes(hora)) {
            nuevosHorarios[dia] = [...nuevosHorarios[dia], hora].sort();
            setHorariosTemp(nuevosHorarios);
        }
    };
    
    const eliminarHorario = (dia, hora) => {
        if (window.confirm(`¿Eliminar el horario ${dia} ${hora}?`)) {
            const nuevosHorarios = {...horariosTemp};
            nuevosHorarios[dia] = nuevosHorarios[dia].filter(h => h !== hora);
            setHorariosTemp(nuevosHorarios);
        }
    };
    
    const guardar = async () => {
        await guardarCambios('horarios', horariosTemp);
        setEditando(false);
    };
    
    const cancelar = () => {
        setHorariosTemp({...horarios});
        setEditando(false);
    };
    
    return (
        <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h2>Configuración de Horarios</h2>
                {!editando ? (
                    <button className="btn btn-primary" onClick={() => setEditando(true)}>
                        ✎ Editar Horarios
                    </button>
                ) : (
                    <div>
                        <button className="btn btn-success" onClick={guardar}>
                            ↓ Guardar
                        </button>
                        <button className="btn btn-secondary" onClick={cancelar}>
                            Cancelar
                        </button>
                    </div>
                )}
            </div>
            
            {editando && <EditorHorarios dias={dias} horarios={horariosTemp} onAgregar={agregarHorario} />}
            
            <div className="grid">
                {dias.map(dia => (
                    <div key={dia} className="card">
                        <h3>{dia}</h3>
                        {(editando ? horariosTemp[dia] : horarios[dia]) && (editando ? horariosTemp[dia] : horarios[dia]).length > 0 ? (
                            (editando ? horariosTemp[dia] : horarios[dia]).map(hora => (
                                <div key={hora} className="horario-item">
                                    <span style={{fontWeight: 'bold'}}>{hora}</span>
                                    {editando && (
                                        <button 
                                            className="btn btn-danger" 
                                            style={{padding: '5px 10px', fontSize: '0.8rem'}}
                                            onClick={() => eliminarHorario(dia, hora)}
                                        >
                                            ✗
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p style={{color: '#6c757d', fontStyle: 'italic'}}>Sin horarios</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function EditorHorarios({ dias, horarios, onAgregar }) {
    const [diaSeleccionado, setDiaSeleccionado] = useState('Lunes');
    const [horaSeleccionada, setHoraSeleccionada] = useState('08:00');
    
    const horasPosibles = [];
    for (let h = 6; h <= 22; h++) {
        horasPosibles.push(`${h.toString().padStart(2, '0')}:00`);
        if (h < 22) horasPosibles.push(`${h.toString().padStart(2, '0')}:30`);
    }
    
    return (
        <div className="card" style={{marginBottom: '20px', background: '#f8f9fa'}}>
            <h3>Agregar Nuevo Horario</h3>
            <div style={{display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap'}}>
                <div className="form-group" style={{flex: 1, minWidth: '150px', marginBottom: 0}}>
                    <label>Día</label>
                    <select value={diaSeleccionado} onChange={(e) => setDiaSeleccionado(e.target.value)}>
                        {dias.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div className="form-group" style={{flex: 1, minWidth: '150px', marginBottom: 0}}>
                    <label>Hora</label>
                    <select value={horaSeleccionada} onChange={(e) => setHoraSeleccionada(e.target.value)}>
                        {horasPosibles.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                </div>
                <button 
                    className="btn btn-success" 
                    onClick={() => onAgregar(diaSeleccionado, horaSeleccionada)}
                >
                    ➕ Agregar
                </button>
            </div>
        </div>
    );
}

function PreciosTab({ precios, guardarCambios }) {
    const [editando, setEditando] = useState(false);
    const [preciosTemp, setPreciosTemp] = useState({...precios});
    
    const guardar = async () => {
        await guardarCambios('precios', preciosTemp);
        setEditando(false);
    };
    
    const cancelar = () => {
        setPreciosTemp({...precios});
        setEditando(false);
    };
    
    return (
        <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h2>Gestión de Precios</h2>
                {!editando ? (
                    <button className="btn btn-primary" onClick={() => setEditando(true)}>
                        ✎ Editar Precios
                    </button>
                ) : (
                    <div>
                        <button className="btn btn-success" onClick={guardar}>
                            ↓ Guardar
                        </button>
                        <button className="btn btn-secondary" onClick={cancelar}>
                            Cancelar
                        </button>
                    </div>
                )}
            </div>
            
            <div className="grid">
                {Object.keys(precios).sort((a, b) => {
                    const numA = parseInt(a.match(/\d+/)?.[0]) || 0;
                    const numB = parseInt(b.match(/\d+/)?.[0]) || 0;
                    return numA - numB;
                }).map(plan => (
                    <div key={plan} className="card">
                        <h3>{plan.replace('_', ' ').toUpperCase()}</h3>
                        <div style={{fontSize: '2rem', fontWeight: 'bold', color: '#667eea', textAlign: 'center', margin: '20px 0'}}>
                            ${editando ? (
                                <input 
                                    type="number"
                                    value={preciosTemp[plan]}
                                    onChange={(e) => setPreciosTemp({...preciosTemp, [plan]: parseInt(e.target.value)})}
                                    style={{fontSize: '2rem', width: '100%', textAlign: 'center', padding: '10px'}}
                                />
                            ) : (
                                precios[plan].toLocaleString()
                            )}
                        </div>
                        <div style={{textAlign: 'center', color: '#6c757d'}}>
                            por mes
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SolicitudesTab({ solicitudes, alumnos, recargarDatos }) {
    const formatearFecha = (fechaISO) => {
        const fecha = new Date(fechaISO + 'T00:00:00');
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const dia = dias[fecha.getDay()];
        const numero = fecha.getDate();
        const mes = fecha.getMonth() + 1;
        const año = fecha.getFullYear().toString().slice(-2);
        return `${dia} ${numero}/${mes}/${año}`;
    };
    
    const handleAprobar = async (solicitud) => {
        try {
            // 1. Encontrar el alumno
            const alumno = alumnos.find(a => a.id === solicitud.alumnoId);
            if (!alumno) {
                alert('Error: Alumno no encontrado');
                return;
            }
            
            // 2. Guardar el recupero como clase puntual (NO modifica horariosAsignados)
            await FirebaseService.guardarRecupero({
                alumnoId: solicitud.alumnoId,
                alumnoNombre: solicitud.alumnoNombre,
                alumnoEmail: solicitud.alumnoEmail,
                fecha: solicitud.fecha,
                dia: solicitud.dia,
                hora: solicitud.hora,
                estado: 'aprobado'
            });
            
            // 3. Decrementar clasesPendientes del alumno
            const alumnoActualizado = {
                ...alumno,
                clasesPendientes: Math.max(0, alumno.clasesPendientes - 1)
            };
            await FirebaseService.guardarAlumno(alumnoActualizado);
            
            // 4. Marcar la cancelacionAlumno original como "recuperado"
            try {
                await FirebaseService.actualizarEstadoCancelacionAlumno(solicitud.cancelacionId, 'recuperado');
            } catch(e) {
                console.warn('No se pudo actualizar cancelacionAlumno:', e);
            }
            
            // 5. Eliminar la solicitud
            await FirebaseService.eliminarSolicitud(solicitud.id);
            
            // Los listeners se encargan de actualizar automáticamente
            alert(`✅ Recupero aprobado! ${solicitud.alumnoNombre} tiene clase el ${solicitud.dia} ${solicitud.fecha} a las ${solicitud.hora}`);
        } catch (error) {
            console.error('Error al aprobar solicitud:', error);
            alert('❌ Error al aprobar solicitud');
        }
    };
    
    const handleRechazar = async (solicitudId) => {
        if (window.confirm('¿Rechazar esta solicitud?')) {
            try {
                // 1. Obtener la solicitud para saber de quién es
                const solicitud = solicitudes.find(s => s.id === solicitudId);
                if (!solicitud) {
                    alert('❌ No se encontró la solicitud');
                    return;
                }
                
                // 2. Obtener el alumno
                const alumno = alumnos.find(a => a.id === solicitud.alumnoId);
                if (!alumno) {
                    alert('❌ No se encontró el alumno');
                    return;
                }
                
                // 3. Restaurar clasesPendientes (incrementar en 1)
                const alumnoActualizado = {
                    ...alumno,
                    clasesPendientes: (alumno.clasesPendientes || 0) + 1
                };
                
                // 4. Marcar solicitud como rechazada (no eliminarla)
                const solicitudActualizada = {
                    ...solicitud,
                    estado: 'rechazada'
                };
                
                // 5. Guardar cambios en Firebase
                await FirebaseService.guardarAlumno(alumnoActualizado);
                await FirebaseService.guardarSolicitud(solicitudActualizada);
                
                // Los listeners se encargan de actualizar automáticamente
                alert(`✅ Solicitud rechazada. Se restauró 1 clase a recuperar para ${solicitud.alumnoNombre}`);
            } catch (error) {
                console.error('Error al rechazar solicitud:', error);
                alert('❌ Error al rechazar solicitud');
            }
        }
    };
    
    const solicitudesPendientes = solicitudes.filter(s => s.estado === 'pendiente');
    
    if (solicitudesPendientes.length === 0) {
        return (
            <div className="alert alert-info">
                <strong>✅ No hay solicitudes pendientes</strong>
                <p style={{marginTop: '10px'}}>Todas las solicitudes han sido procesadas.</p>
            </div>
        );
    }
    
    return (
        <div>
            <h2 style={{marginBottom: '20px'}}>Solicitudes de Recuperación ({solicitudesPendientes.length})</h2>
            
            <div className="grid">
                {solicitudesPendientes.map(solicitud => (
                    <div key={solicitud.id} className="card">
                        <h3 style={{color: '#667eea', marginBottom: '15px'}}>
                            {solicitud.alumnoNombre}
                        </h3>
                        <div style={{fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center', color: '#667eea', marginBottom: '10px'}}>
                            {formatearFecha(solicitud.fecha)}
                        </div>
                        <div style={{fontSize: '1.8rem', fontWeight: 'bold', textAlign: 'center', color: '#667eea', margin: '10px 0'}}>
                            {solicitud.hora}
                        </div>
                        <div className="info-row">
                            <span className="label">Email:</span>
                            <span className="value" style={{fontSize: '0.85rem'}}>{solicitud.alumnoEmail}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Solicitado:</span>
                            <span className="value">{new Date(solicitud.fechaSolicitud).toLocaleString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</span>
                        </div>
                        
                        <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                            <button 
                                className="btn btn-success" 
                                style={{flex: 1}}
                                onClick={() => handleAprobar(solicitud)}
                            >
                                ✅ Aprobar
                            </button>
                            <button 
                                className="btn btn-danger" 
                                style={{flex: 1}}
                                onClick={() => handleRechazar(solicitud.id)}
                            >
                                ❌ Rechazar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AlumnoDashboard({ alumno, alumnos, horarios, precios, cancelaciones, setCancelaciones, cancelacionesAlumno, setCancelacionesAlumno, solicitudes, recuperos, onLogout, recargarDatos }) {
    const [tabActiva, setTabActiva] = useState('misClases');
    const [mesSeleccionado, setMesSeleccionado] = useState(new Date());
    const [clasesCanceladas, setClasesCanceladas] = useState({}); // {fecha-horario: true}
    
    // Función para formatear fecha como "Viernes 13/2/26"
    const formatearFecha = (fechaISO) => {
        const fecha = new Date(fechaISO + 'T00:00:00');
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const dia = dias[fecha.getDay()];
        const numero = fecha.getDate();
        const mes = fecha.getMonth() + 1;
        const año = fecha.getFullYear().toString().slice(-2);
        return `${dia} ${numero}/${mes}/${año}`;
    };
    
    // Función para obtener las clases del alumno en formato de fecha
    const obtenerClasesDelMes = (fecha) => {
        const fechaStr = fechaLocal(fecha);
        const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fecha.getDay()];
        
        // Clases regulares (horarios recurrentes)
        const clasesRegulares = alumno.horariosAsignados
            .filter(h => h.split('-')[0] === diaSemana)
            .map(h => {
                const [dia, hora] = h.split('-');
                const estaCancelada = cancelacionesAlumno.some(c => 
                    c.alumnoId === alumno.id && 
                    c.fecha === fechaStr && 
                    c.hora === hora
                );
                return { fecha: fechaStr, dia, hora, horario: h, cancelada: estaCancelada, tipo: 'regular' };
            });
        
        // Recuperos aprobados para esta fecha
        const clasesRecupero = (recuperos || [])
            .filter(r => r.fecha === fechaStr && r.alumnoId === alumno.id && r.estado === 'aprobado')
            .map(r => ({
                fecha: fechaStr, dia: r.dia, hora: r.hora,
                horario: `${r.dia}-${r.hora}`, cancelada: false, tipo: 'recupero'
            }));
        
        // Solicitudes pendientes de recupero para esta fecha
        const clasesPendientes = (solicitudes || [])
            .filter(s => s.fecha === fechaStr && s.alumnoId === alumno.id && s.estado === 'pendiente')
            .map(s => ({
                fecha: fechaStr, dia: s.dia, hora: s.hora,
                horario: `${s.dia}-${s.hora}`, cancelada: false, tipo: 'pendiente'
            }));
        
        return [...clasesRegulares, ...clasesRecupero, ...clasesPendientes];
    };
    
    // Función para obtener todos los días del mes con sus clases
    const obtenerDiasDelMes = (mesActual) => {
        const año = mesActual.getFullYear();
        const mes = mesActual.getMonth();
        const primerDia = new Date(año, mes, 1);
        const ultimoDia = new Date(año, mes + 1, 0);
        const diasDelMes = [];
        
        for (let d = 1; d <= ultimoDia.getDate(); d++) {
            const fecha = new Date(año, mes, d);
            const esFeriado = FERIADOS_FIJOS.includes(fechaLocal(fecha));
            // Si es feriado, no mostrar clases
            const clases = esFeriado ? [] : obtenerClasesDelMes(fecha);
            diasDelMes.push({
                fecha,
                numero: d,
                clases,
                esHoy: fecha.toDateString() === new Date().toDateString(),
                esFeriado: esFeriado
            });
        }
        
        return diasDelMes;
    };
    
    // Función para renderizar el calendario
    const renderizarCalendario = () => {
        const diasDelMes = obtenerDiasDelMes(mesSeleccionado);
        const primerDia = new Date(mesSeleccionado.getFullYear(), mesSeleccionado.getMonth(), 1).getDay();
        // Ajustar para que empiece en lunes: si lunes=1, entonces diasVacios = primerDia - 1
        const diasVaciosCalculado = primerDia === 0 ? 6 : primerDia - 1;
        const diasVacios = Array(diasVaciosCalculado).fill(null);
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        
        return (
            <div>
                <h2 style={{marginBottom: '20px'}}>Mis Clases - {meses[mesSeleccionado.getMonth()]} {mesSeleccionado.getFullYear()}</h2>
                
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                    <button className="btn btn-secondary" onClick={() => setMesSeleccionado(new Date(mesSeleccionado.getFullYear(), mesSeleccionado.getMonth() - 1, 1))}>
                        ← Mes Anterior
                    </button>
                    <button className="btn btn-secondary" onClick={() => setMesSeleccionado(new Date())}>
                        Hoy
                    </button>
                    <button className="btn btn-secondary" onClick={() => setMesSeleccionado(new Date(mesSeleccionado.getFullYear(), mesSeleccionado.getMonth() + 1, 1))}>
                        Mes Siguiente →
                    </button>
                </div>
                
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px'}}>
                    {/* Cabecera días */}
                    {diasSemana.map(dia => (
                        <div key={dia} style={{textAlign: 'center', fontWeight: 'bold', color: '#667eea', padding: '10px', background: '#f8f9fa', borderRadius: '8px'}}>
                            {dia}
                        </div>
                    ))}
                    {/* Días vacíos de inicio */}
                    {diasVacios.map((_, idx) => (
                        <div key={`vacio-${idx}`} className="cal-cell" style={{minHeight: '100px'}}></div>
                    ))}
                    {diasDelMes.map((dia, idx) => (
                        <div 
                            key={idx}
                            className="cal-cell"
                            style={{
                                minHeight: '100px',
                                padding: '10px',
                                border: '1px solid #dee2e6',
                                borderRadius: '8px',
                                background: dia.esFeriado ? '#fff3cd' : dia.esHoy ? '#e7f3ff' : 'white',
                            }}
                        >
                            <div className="cal-num" style={{fontWeight: 'bold', color: dia.esHoy ? '#667eea' : '#495057', marginBottom: '5px'}}>
                                {dia.numero}
                            </div>
                            {dia.esFeriado && (
                                <div style={{fontSize: '0.75rem', color: '#ff9800', fontWeight: 'bold', marginBottom: '5px'}}>
                                    Fer.
                                </div>
                            )}
                            {dia.clases.map((clase, idx) => {
                                const estaCancelada = clase.cancelada;
                                const esRecupero = clase.tipo === 'recupero';
                                const esPendiente = clase.tipo === 'pendiente';
                                const fechaClaseObj = new Date(`${clase.fecha}T${clase.hora}:00`);
                                const yaPaso = fechaClaseObj < new Date();
                                const bgColor = estaCancelada ? '#ccc' : esRecupero ? '#28a745' : esPendiente ? '#ff9800' : '#667eea';
                                
                                return (
                                    <div key={idx} style={{marginBottom: '3px'}}>
                                        <div className="cal-pill" style={{
                                            fontSize: '0.75rem',
                                            background: bgColor,
                                            color: estaCancelada ? '#666' : 'white',
                                            padding: '3px 5px',
                                            borderRadius: '4px',
                                            marginBottom: '2px',
                                            textDecoration: estaCancelada ? 'line-through' : 'none'
                                        }}>
                                            {clase.hora}{esRecupero ? ' 🔄' : esPendiente ? ' ⏳' : ''}
                                        </div>
                                        {!estaCancelada && !yaPaso && !esRecupero && !esPendiente && (
                                            <button
                                                className="cal-cancel-btn"
                                                style={{
                                                    fontSize: '0.7rem', padding: '2px 6px',
                                                    background: '#dc3545', color: 'white',
                                                    border: 'none', borderRadius: '3px',
                                                    cursor: 'pointer', width: '100%'
                                                }}
                                                onClick={() => {
                                                    const fechaStr = fechaLocal(new Date(mesSeleccionado.getFullYear(), mesSeleccionado.getMonth(), dia.numero));
                                                    handleCancelar(clase.horario, fechaStr);
                                                }}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
                
                <div style={{marginTop: '15px', display: 'flex', gap: '15px', flexWrap: 'wrap', fontSize: '0.8rem'}}>
                    <span><span style={{display:'inline-block', width:'12px', height:'12px', background:'#667eea', borderRadius:'3px', marginRight:'4px'}}></span>Clase regular</span>
                    <span><span style={{display:'inline-block', width:'12px', height:'12px', background:'#28a745', borderRadius:'3px', marginRight:'4px'}}></span>Recupero aprobado 🔄</span>
                    <span><span style={{display:'inline-block', width:'12px', height:'12px', background:'#ff9800', borderRadius:'3px', marginRight:'4px'}}></span>Recupero pendiente ⏳</span>
                    <span><span style={{display:'inline-block', width:'12px', height:'12px', background:'#ccc', borderRadius:'3px', marginRight:'4px'}}></span>Cancelada</span>
                </div>
                
                <div className="alert alert-info" style={{marginTop: '15px'}}>
                    ℹ️ Podés cancelar hasta 3 horas antes del horario de clase.
                </div>
            </div>
        );
    };
    
    const handleSolicitarCupo = async (slot) => {
        try {
            const nuevaSolicitud = {
                alumnoId: alumno.id,
                alumnoNombre: `${alumno.nombre} ${alumno.apellido}`,
                alumnoEmail: alumno.email,
                cancelacionId: null,
                dia: slot.dia,
                hora: slot.hora,
                fecha: slot.fecha,
                estado: 'pendiente',
                fechaSolicitud: new Date().toISOString()
            };
            
            await FirebaseService.guardarSolicitud(nuevaSolicitud);
            // Los listeners se encargan de actualizar automáticamente
            alert('✅ Solicitud enviada! La profesora te confirmará pronto.');
        } catch (error) {
            console.error('Error al solicitar cupo:', error);
            alert('❌ Error al enviar solicitud');
        }
    };
    
    // Verificar si ya solicitó este cupo
    const yaSolicito = (cancelacionId) => {
        return solicitudes.some(s => 
            s.cancelacionId === cancelacionId && 
            s.alumnoId === alumno.id &&
            s.estado === 'pendiente'
        );
    };
    
    // Función para ordenar cupos por fecha y hora
    const ordenarCupos = (cupos) => {
        return cupos.sort((a, b) => {
            // Primero por fecha
            const fechaA = new Date(a.fecha).getTime();
            const fechaB = new Date(b.fecha).getTime();
            if (fechaA !== fechaB) {
                return fechaA - fechaB;
            }
            // Si la fecha es igual, por hora (de temprano a tarde)
            const horaA = a.hora.split(':').map(Number);
            const horaB = b.hora.split(':').map(Number);
            const minutosA = horaA[0] * 60 + horaA[1];
            const minutosB = horaB[0] * 60 + horaB[1];
            return minutosA - minutosB;
        });
    };
    
    // Función para ir al mes anterior
    const irMesAnterior = () => {
        setMesSeleccionado(new Date(mesSeleccionado.getFullYear(), mesSeleccionado.getMonth() - 1, 1));
    };
    
    // Función para ir al mes siguiente
    const irMesSiguiente = () => {
        setMesSeleccionado(new Date(mesSeleccionado.getFullYear(), mesSeleccionado.getMonth() + 1, 1));
    };
    
    // Función para filtrar cupos del mes seleccionado
    const filtrarCuposMes = (cupos) => {
        return cupos.filter(cupo => {
            const fecha = new Date(cupo.fecha);
            return fecha.getMonth() === mesSeleccionado.getMonth() && 
                   fecha.getFullYear() === mesSeleccionado.getFullYear();
        });
    };
    
    // Función para obtener nombre del mes
    const obtenerNombreMes = () => {
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${meses[mesSeleccionado.getMonth()]} ${mesSeleccionado.getFullYear()}`;
    };
    
    const handleCancelar = async (horario, fechaStr) => {
        try {
            // Validar que no sea una clase pasada
            const [dia, hora] = horario.split('-');
            const [año, mes, día] = fechaStr.split('-');
            
            // Crear fecha de la clase correctamente
            const [horaNum, minNum] = hora.split(':').map(Number);
            const fechaClase = new Date(parseInt(año), parseInt(mes) - 1, parseInt(día), horaNum, minNum, 0);
            const ahora = new Date();
            
            if (fechaClase < ahora) {
                alert('❌ No podés cancelar una clase que ya pasó');
                return;
            }
            
            // Calcular si quedan más de 3 horas
            const horasRestantes = (fechaClase - ahora) / (1000 * 60 * 60);
            const puedeRecuperar = horasRestantes >= 3;
            
            if (!window.confirm(`¿Confirmar cancelación de ${horario}?`)) {
                return;
            }
            
            // Guardar cancelación específica (fecha + alumno + horario)
            const nuevaCancelacionAlumno = {
                alumnoId: alumno.id,
                alumnoNombre: `${alumno.nombre} ${alumno.apellido}`,
                alumnoEmail: alumno.email,
                fecha: fechaStr,
                dia,
                hora,
                estado: 'pendiente',
                puedeRecuperar: puedeRecuperar,
                fechaCancelacion: new Date().toISOString()
            };
            
            await FirebaseService.guardarCancelacionAlumno(nuevaCancelacionAlumno);
            
            // Agregar a cancelacionesAlumno local
            setCancelacionesAlumno([...cancelacionesAlumno, nuevaCancelacionAlumno]);
            
            // Incrementar clasesPendientes solo si puede recuperar
            let alumnoActualizado = { ...alumno };
            if (puedeRecuperar) {
                alumnoActualizado.clasesPendientes = alumno.clasesPendientes + 1;
            }
            
            await FirebaseService.guardarAlumno(alumnoActualizado);
            
            // Los listeners se encargan de actualizar automáticamente
            
            alert('✅ Clase cancelada.');
        } catch (error) {
            console.error('❌ ERROR en handleCancelar:', error);
            alert('❌ Error al cancelar clase: ' + error.message);
        }
    };
    
    return (
        <div className="container">
            <div className="header">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span style={{fontSize: '1.1rem', fontWeight: '600'}}>
                        Hola, {alumno?.nombre || 'Alumno'}!
                    </span>
                    <HeaderLogoSVG width={120} style={{filter: 'brightness(0) invert(1)', opacity: 0.9}} />
                </div>
            </div>
            
            <div className="tabs">
                <button className={`tab ${tabActiva === 'misClases' ? 'active' : ''}`} onClick={() => setTabActiva('misClases')}>
                    <span className="tab-icon">📆</span> <span>Mis Clases</span>
                </button>
                <button className={`tab ${tabActiva === 'recuperar' ? 'active' : ''}`} onClick={() => setTabActiva('recuperar')}>
                    <span className="tab-icon">↻</span> <span>Recuperar</span>
                </button>
                <button className={`tab ${tabActiva === 'miInfo' ? 'active' : ''}`} onClick={() => setTabActiva('miInfo')}>
                    <span className="tab-icon">◉</span> <span>Mi Info</span>
                </button>
            </div>
            
            <div className="content">
                {tabActiva === 'misClases' && renderizarCalendario()}
                
                {tabActiva === 'recuperar' && (
                    <TabRecuperar
                        alumno={alumno}
                        alumnos={alumnos}
                        horarios={horarios}
                        cancelacionesAlumno={cancelacionesAlumno}
                        recuperos={recuperos}
                        solicitudes={solicitudes}
                        onSolicitarCupo={handleSolicitarCupo}
                        formatearFecha={formatearFecha}
                    />
                )}
                
                {tabActiva === 'miInfo' && alumno && (
                    <div>
                        <h2 style={{marginBottom: '20px'}}>Mi Información</h2>
                        <div className="card">
                            <h3>{alumno?.nombre || ''} {alumno?.apellido || ''}</h3>
                            <div className="info-row">
                                <span className="label">Email:</span>
                                <span className="value">{alumno?.email || 'N/A'}</span>
                            </div>
                            <div className="info-row">
                                <span className="label">Abono:</span>
                                <span className="badge badge-info">{alumno?.abono?.replace('_', ' ').toUpperCase() || 'N/A'}</span>
                            </div>
                            <div className="info-row">
                                <span className="label">Precio:</span>
                                <span className="value" style={{fontWeight: 'bold', color: '#667eea', fontSize: '1.1rem'}}>
                                    {precios && alumno?.abono && precios[alumno.abono] ? '$' + precios[alumno.abono].toLocaleString('es-AR') : 'Cargando...'}
                                </span>
                            </div>
                            {alumno?.clasesPendientes > 0 && (
                                <div className="info-row">
                                    <span className="label">Clases a recuperar:</span>
                                    <span className="badge badge-warning">{alumno.clasesPendientes}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="footer">
                <button onClick={onLogout} className="btn btn-secondary">
                    Cerrar Sesión
                </button>
            </div>
        </div>
    );
}

function TabRecuperar({ alumno, alumnos, horarios, cancelacionesAlumno, recuperos, solicitudes, onSolicitarCupo, formatearFecha }) {
    const CAPACIDAD_MAX = 5;
    const [semanas, setSemanas] = useState(2); // cuántas semanas mostrar hacia adelante
    
    // Calcular ocupados en un slot fecha+hora específico
    const calcularOcupados = (fechaStr, diaSemana, hora) => {
        // Alumnos con ese horario recurrente
        const conHorario = alumnos.filter(a => 
            (a.horariosAsignados || []).includes(`${diaSemana}-${hora}`)
        );
        // Menos los que cancelaron ese día específico
        const cancelados = cancelacionesAlumno.filter(c => 
            c.fecha === fechaStr && c.hora === hora && c.estado !== 'recuperado'
        ).map(c => c.alumnoId);
        
        const regulares = conHorario.filter(a => !cancelados.includes(a.id)).length;
        
        // Más los recuperos aprobados para esa fecha/hora
        const conRecupero = (recuperos || []).filter(r => 
            r.fecha === fechaStr && r.hora === hora && r.estado === 'aprobado'
        ).length;
        
        return regulares + conRecupero;
    };
    
    // Generar todos los slots disponibles en los próximos N días
    const generarSlotsDisponibles = () => {
        const slots = [];
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const diasAdelante = semanas * 7;
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        
        for (let i = 0; i <= diasAdelante; i++) {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() + i);
            const fechaStr = fechaLocal(fecha);
            
            // Saltar feriados
            if (FERIADOS_FIJOS.includes(fechaStr)) continue;
            
            const diaSemana = diasSemana[fecha.getDay()];
            const horariosDelDia = horarios[diaSemana] || [];
            
            for (const hora of horariosDelDia) {
                // Verificar que la clase no haya pasado (con al menos 3hs de anticipación)
                const fechaHoraClase = new Date(`${fechaStr}T${hora}:00`);
                const horasRestantes = (fechaHoraClase - new Date()) / (1000 * 60 * 60);
                if (horasRestantes < 3) continue;
                
                // Calcular ocupados
                const ocupados = calcularOcupados(fechaStr, diaSemana, hora);
                const libres = CAPACIDAD_MAX - ocupados;
                
                if (libres <= 0) continue;
                
                // El alumno ya tiene clase ahí ese día (regular o recupero)
                const yaTimeneClase = (alumno.horariosAsignados || []).includes(`${diaSemana}-${hora}`) &&
                    !cancelacionesAlumno.some(c => c.alumnoId === alumno.id && c.fecha === fechaStr && c.hora === hora);
                const yaTimeneRecupero = (recuperos || []).some(r => 
                    r.alumnoId === alumno.id && r.fecha === fechaStr && r.hora === hora && r.estado === 'aprobado'
                );
                if (yaTimeneClase || yaTimeneRecupero) continue;
                
                // Ya tiene solicitud pendiente para ese slot
                const yaSolicito = solicitudes.some(s => 
                    s.alumnoId === alumno.id && s.fecha === fechaStr && s.hora === hora && s.estado === 'pendiente'
                );
                
                slots.push({ fecha: fechaStr, dia: diaSemana, hora, libres, yaSolicito });
            }
        }
        
        // Ordenar por fecha y hora
        return slots.sort((a, b) => {
            if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
            return a.hora.localeCompare(b.hora);
        });
    };
    
    const slots = generarSlotsDisponibles();
    
    // Solicitudes rechazadas del alumno
    const solicitudesRechazadas = (solicitudes || []).filter(s => 
        s.alumnoId === alumno.id && s.estado === 'rechazada'
    );
    
    if (alumno.clasesPendientes === 0) {
        return (
            <div>
                <h2 style={{marginBottom: '20px'}}>Recuperar Clases</h2>
                <div className="alert alert-success">
                    ✅ No tenés clases pendientes de recuperar
                </div>
            </div>
        );
    }
    
    return (
        <div>
            <h2 style={{marginBottom: '10px'}}>Recuperar Clases</h2>
            
            {solicitudesRechazadas.length > 0 && (
                <div className="alert alert-danger" style={{marginBottom: '20px'}}>
                    <strong>⚠️ Solicitudes rechazadas</strong>
                    <p style={{marginTop: '8px', marginBottom: '0'}}>Las siguientes solicitudes fueron rechazadas por la profesora. Podés solicitar otro horario:</p>
                    {solicitudesRechazadas.map(s => (
                        <div key={s.id} style={{fontSize: '0.9rem', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(114, 28, 36, 0.3)'}}>
                            {formatearFecha(s.fecha)} a las {s.hora} — {s.razon || 'Sin motivo especificado'}
                        </div>
                    ))}
                </div>
            )}
            
            <div className="alert alert-warning" style={{marginBottom: '20px'}}>
                Tenés <strong>{alumno.clasesPendientes}</strong> clase(s) para recuperar. Elegí un horario disponible:
            </div>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '12px 16px', background: '#f8f9fa', borderRadius: '8px'}}>
                <span style={{color: '#6c757d', fontSize: '0.9rem'}}>Mostrando próximos {semanas * 7} días</span>
                <div style={{display: 'flex', gap: '8px'}}>
                    <button className="btn btn-secondary" style={{padding: '6px 14px', fontSize: '0.85rem'}} 
                        onClick={() => setSemanas(Math.max(1, semanas - 1))} disabled={semanas <= 1}>
                        − Menos
                    </button>
                    <button className="btn btn-secondary" style={{padding: '6px 14px', fontSize: '0.85rem'}}
                        onClick={() => setSemanas(semanas + 1)}>
                        + Más semanas
                    </button>
                </div>
            </div>
            
            {slots.length === 0 ? (
                <div className="alert alert-info">
                    No hay lugares disponibles en los próximos {semanas * 7} días. Probá expandir el período o consultá con la profesora.
                </div>
            ) : (
                <div className="grid">
                    {slots.map(slot => (
                        <div key={`${slot.fecha}-${slot.hora}`} className="card" style={{borderColor: slot.yaSolicito ? '#ffc107' : '#e9ecef'}}>
                            <div style={{fontSize: '1.1rem', fontWeight: 'bold', color: '#667eea', textAlign: 'center', marginBottom: '6px'}}>
                                {formatearFecha(slot.fecha)}
                            </div>
                            <div style={{fontSize: '2rem', fontWeight: 'bold', color: '#667eea', textAlign: 'center', margin: '8px 0'}}>
                                {slot.hora}
                            </div>
                            {slot.yaSolicito ? (
                                <div className="alert alert-warning" style={{textAlign: 'center', margin: 0, padding: '8px'}}>
                                    ⏳ Solicitud enviada<br/>
                                    <small>Esperando confirmación</small>
                                </div>
                            ) : (
                                <button 
                                    className="btn btn-success" 
                                    style={{width: '100%'}}
                                    onClick={() => onSolicitarCupo(slot)}
                                >
                                    Solicitar este lugar
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Modal({ children, onClose }) {
    return (
        <div className="modal" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div></div>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                {children}
            </div>
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
