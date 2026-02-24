const { useState, useEffect } = React;

// --- CONFIGURACIÓN Y CONSTANTES ---
const FERIADOS_FIJOS = [
    '2026-01-01', '2026-02-09', '2026-02-10', '2026-03-24', '2026-04-02', 
    '2026-04-10', '2026-05-01', '2026-05-25', '2026-06-17', '2026-06-20', 
    '2026-07-09', '2026-08-17', '2026-10-12', '2026-11-02', '2026-12-08', '2026-12-25'
];

const fechaLocal = (fecha) => {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// --- SERVICIOS DE FIREBASE ---
const FirebaseService = {
    async obtenerAlumnos() {
        const snapshot = await db.collection('alumnos').get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    },
    async guardarAlumno(alumno) {
        if (alumno.id) {
            await db.collection('alumnos').doc(alumno.id).set(alumno);
        } else {
            const docRef = await db.collection('alumnos').add(alumno);
            return docRef.id;
        }
    },
    async eliminarAlumno(id) {
        await db.collection('alumnos').doc(id).delete();
    },
    async obtenerHorarios() {
        const doc = await db.collection('config').doc('horarios').get();
        return doc.exists ? doc.data() : {};
    },
    async guardarHorarios(horarios) {
        await db.collection('config').doc('horarios').set(horarios);
    },
    async obtenerPrecios() {
        const doc = await db.collection('config').doc('precios').get();
        return doc.exists ? doc.data() : {};
    },
    async guardarPrecios(precios) {
        await db.collection('config').doc('precios').set(precios);
    },
    async eliminarSolicitud(id) {
        await db.collection('solicitudes').doc(id.toString()).delete();
    },
    async guardarSolicitud(solicitud) {
        if (solicitud.id) {
            await db.collection('solicitudes').doc(solicitud.id.toString()).set(solicitud, { merge: true });
        } else {
            await db.collection('solicitudes').add(solicitud);
        }
    },
    async guardarRecupero(recupero) {
        await db.collection('recuperos').add({...recupero, fechaCreacion: new Date().toISOString()});
    },
    async actualizarEstadoCancelacionAlumno(id, estado) {
        await db.collection('cancelacionesAlumno').doc(id).update({ estado });
    },
    async resetearAlumno(alumnoId) {
        const batch = db.batch();
        const cancelaciones = await db.collection('cancelacionesAlumno').where('alumnoId', '==', alumnoId).get();
        cancelaciones.docs.forEach(doc => batch.delete(doc.ref));
        const recuperos = await db.collection('recuperos').where('alumnoId', '==', alumnoId).get();
        recuperos.docs.forEach(doc => batch.delete(doc.ref));
        const solicitudes = await db.collection('solicitudes').where('alumnoId', '==', alumnoId).get();
        solicitudes.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        await db.collection('alumnos').doc(alumnoId).update({ clasesPendientes: 0, clasesUsadas: 0 });
    }
};

// --- COMPONENTE PRINCIPAL APP ---
function App() {
    const [cargando, setCargando] = useState(true);
    const [userType, setUserType] = useState(null);
    const [usuarioActual, setUsuarioActual] = useState(null);
    const [authUser, setAuthUser] = useState(null);
    const [alumnos, setAlumnos] = useState([]);
    const [horarios, setHorarios] = useState({});
    const [precios, setPrecios] = useState({});
    const [solicitudes, setSolicitudes] = useState([]);
    const [recuperos, setRecuperos] = useState([]);
    const [cancelacionesAlumno, setCancelacionesAlumno] = useState([]);

    useEffect(() => {
        return auth.onAuthStateChanged((user) => {
            setAuthUser(user);
            if (!user) setCargando(false);
        });
    }, []);

    useEffect(() => {
        if (!authUser) return;
        const unsubAlumnos = db.collection('alumnos').onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAlumnos(data);
            if (authUser.email === 'marinapilatesestudio@gmail.com') {
                setUserType('admin');
            } else {
                setUserType('alumno');
                const p = data.find(a => a.email === authUser.email);
                if (p) setUsuarioActual(p);
            }
            setCargando(false);
        });
        const unsubHorarios = db.collection('config').doc('horarios').onSnapshot(doc => setHorarios(doc.data() || {}));
        const unsubPrecios = db.collection('config').doc('precios').onSnapshot(doc => setPrecios(doc.data() || {}));
        const unsubSoli = db.collection('solicitudes').onSnapshot(snap => setSolicitudes(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubRecu = db.collection('recuperos').onSnapshot(snap => setRecuperos(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubCanc = db.collection('cancelacionesAlumno').onSnapshot(snap => setCancelacionesAlumno(snap.docs.map(d => ({id: d.id, ...d.data()}))));

        return () => { unsubAlumnos(); unsubHorarios(); unsubPrecios(); unsubSoli(); unsubRecu(); unsubCanc(); };
    }, [authUser]);

    const handleLogout = () => auth.signOut();

    if (cargando) return <div className="container"><div className="loading"><LogoSVG width={200}/><p>Cargando...</p><div className="spinner"></div></div></div>;
    if (!authUser) return <LoginScreen onLogin={() => {}} />;

    return (
        <div className="container">
            {userType === 'admin' ? (
                <AdminDashboard alumnos={alumnos} horarios={horarios} precios={precios} solicitudes={solicitudes} recuperos={recuperos} cancelacionesAlumno={cancelacionesAlumno} onLogout={handleLogout} />
            ) : (
                <AlumnoDashboard alumno={usuarioActual} alumnos={alumnos} horarios={horarios} precios={precios} solicitudes={solicitudes} recuperos={recuperos} cancelacionesAlumno={cancelacionesAlumno} onLogout={handleLogout} />
            )}
        </div>
    );
}

// --- PANTALLA DE LOGIN ---
function LoginScreen({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [vista, setVista] = useState('login');
    const [resetEmail, setResetEmail] = useState('');
    const [activarEmail, setActivarEmail] = useState('');
    const [mostrarPassword, setMostrarPassword] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        try { await auth.signInWithEmailAndPassword(email.trim().toLowerCase(), password); } 
        catch (err) { setError('Email o contraseña incorrectos'); }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        try { await auth.sendPasswordResetEmail(resetEmail.trim().toLowerCase()); alert('Email enviado'); setVista('login'); } 
        catch (err) { setError('Error al enviar email'); }
    };

    const handleActivar = async (e) => {
        e.preventDefault();
        setError('');
        const emailNorm = activarEmail.trim().toLowerCase();
        try {
            const autorizado = await db.collection('alumnos_autorizados').where('email', '==', emailNorm).get();
            if (autorizado.empty) { setError('Email no autorizado por Marina.'); return; }
            await auth.sendPasswordResetEmail(emailNorm);
            alert('¡Listo! Revisá tu email para crear tu contraseña.');
            setVista('login');
        } catch (err) { setError('Error al activar cuenta'); }
    };

    if (vista === 'reset') return (
        <div style={{maxWidth:'400px', margin:'50px auto', background:'white', padding:'40px', borderRadius:'12px'}}>
            <h2>Recuperar Contraseña</h2>
            <form onSubmit={handleReset}><div className="form-group"><label>Email</label><input type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} required/></div><button type="submit" className="btn btn-primary" style={{width:'100%'}}>Enviar Link</button></form>
            <button onClick={()=>setVista('login')} className="btn btn-secondary" style={{width:'100%', marginTop:'10px'}}>Volver</button>
        </div>
    );

    if (vista === 'activar') return (
        <div style={{maxWidth:'400px', margin:'50px auto', background:'white', padding:'40px', borderRadius:'12px'}}>
            <h2>Activar mi Cuenta</h2>
            <p style={{fontSize:'0.9rem', color:'#666', marginBottom:'15px'}}>Si Marina ya te registró, ingresá tu email para recibir el link de activación.</p>
            <form onSubmit={handleActivar}><div className="form-group"><label>Email</label><input type="email" value={activarEmail} onChange={e=>setActivarEmail(e.target.value)} required/></div><button type="submit" className="btn btn-success" style={{width:'100%'}}>Activar</button></form>
            <button onClick={()=>setVista('login')} className="btn btn-secondary" style={{width:'100%', marginTop:'10px'}}>Volver</button>
        </div>
    );

    return (
        <div style={{maxWidth:'400px', margin:'50px auto', background:'white', padding:'40px', borderRadius:'12px'}}>
            <LogoSVG width={200} style={{margin:'0 auto 30px'}}/>
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleLogin}>
                <div className="form-group"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
                <div className="form-group">
                    <label>Contraseña</label>
                    <div className="password-wrapper">
                        <input type={mostrarPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} required/>
                        <button type="button" className="password-toggle" onClick={()=>setMostrarPassword(!mostrarPassword)}>{mostrarPassword ? '🙈' : '👁'}</button>
                    </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{width:'100%'}}>Ingresar</button>
            </form>
            <div style={{marginTop:'20px', textAlign:'center'}}>
                <button onClick={()=>setVista('reset')} style={{background:'none', border:'none', color:'#667eea', textDecoration:'underline', cursor:'pointer'}}>¿Olvidaste tu contraseña?</button><br/><br/>
                <button onClick={()=>setVista('activar')} className="btn btn-success" style={{fontSize:'0.85rem'}}>Primer ingreso: Activar cuenta</button>
            </div>
        </div>
    );
}
// --- DASHBOARD ADMIN ---
function AdminDashboard({ alumnos, horarios, precios, solicitudes, recuperos, cancelacionesAlumno, onLogout }) {
    const [tabActiva, setTabActiva] = useState('cancelaciones');
    const [alumnoEditando, setAlumnoEditando] = useState(null);
    const [mostrarNuevo, setMostrarNuevo] = useState(false);

    return (
        <>
            <div className="header">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{textAlign:'left'}}>
                        <h1 style={{fontSize:'1.2rem', margin:0}}>Panel Marina Pilates</h1>
                    </div>
                    <HeaderLogoSVG width={120} style={{filter:'brightness(0) invert(1)'}}/>
                </div>
            </div>
            <div className="tabs">
                <button className={`tab ${tabActiva === 'calendario'?'active':''}`} onClick={()=>setTabActiva('calendario')}>📆 Calendario</button>
                <button className={`tab ${tabActiva === 'cancelaciones'?'active':''}`} onClick={()=>setTabActiva('cancelaciones')}>◎ Solicitudes ({solicitudes.length})</button>
                <button className={`tab ${tabActiva === 'alumnos'?'active':''}`} onClick={()=>setTabActiva('alumnos')}>◉ Alumnos</button>
                <button className={`tab ${tabActiva === 'horarios'?'active':''}`} onClick={()=>setTabActiva('horarios')}>⏱ Horarios</button>
                <button className={`tab ${tabActiva === 'precios'?'active':''}`} onClick={()=>setTabActiva('precios')}>◇ Precios</button>
            </div>
            <div className="content">
                {tabActiva === 'calendario' && <CalendarioAdminTab alumnos={alumnos} cancelacionesAlumno={cancelacionesAlumno} recuperos={recuperos} />}
                {tabActiva === 'cancelaciones' && <SolicitudesTab solicitudes={solicitudes} alumnos={alumnos} />}
                {tabActiva === 'alumnos' && (
                    <AlumnosTab 
                        alumnos={alumnos} 
                        precios={precios} 
                        horarios={horarios} 
                        onEditar={(a) => setAlumnoEditando(a)} 
                        onNuevo={() => setMostrarNuevo(true)}
                    />
                )}
                {tabActiva === 'horarios' && <HorariosTab horarios={horarios} />}
                {tabActiva === 'precios' && <PreciosTab precios={precios} />}
            </div>
            
            {alumnoEditando && (
                <FormularioAlumno 
                    alumno={alumnoEditando} 
                    horarios={horarios} 
                    precios={precios}
                    onClose={()=>setAlumnoEditando(null)} 
                    onSave={(datos) => { FirebaseService.guardarAlumno(datos); setAlumnoEditando(null); }} 
                />
            )}
            {mostrarNuevo && (
                <FormularioAlumno 
                    alumno={null} 
                    horarios={horarios} 
                    precios={precios}
                    onClose={()=>setMostrarNuevo(false)} 
                    onSave={(datos) => { FirebaseService.guardarAlumno(datos); setMostrarNuevo(false); }} 
                />
            )}

            <div className="footer"><button onClick={onLogout} className="btn btn-secondary">Cerrar Sesión</button></div>
        </>
    );
}

// --- DASHBOARD ALUMNO ---
function AlumnoDashboard({ alumno, alumnos, horarios, precios, solicitudes, recuperos, cancelacionesAlumno, onLogout }) {
    const [tabActiva, setTabActiva] = useState('misClases');

    return (
        <>
            <div className="header">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{color:'white', fontWeight:'bold'}}>Hola, {alumno.nombre}!</span>
                    <HeaderLogoSVG width={120} style={{filter:'brightness(0) invert(1)'}}/>
                </div>
            </div>
            <div className="tabs">
                <button className={`tab ${tabActiva === 'misClases'?'active':''}`} onClick={()=>setTabActiva('misClases')}>📆 Mis Clases</button>
                <button className={`tab ${tabActiva === 'recuperar'?'active':''}`} onClick={()=>setTabActiva('recuperar')}>↻ Recuperar</button>
                <button className={`tab ${tabActiva === 'miInfo'?'active':''}`} onClick={()=>setTabActiva('miInfo')}>◉ Mi Info</button>
            </div>
            <div className="content">
                {tabActiva === 'misClases' && (
                    <CalendarioAlumno 
                        alumno={alumno} 
                        cancelacionesAlumno={cancelacionesAlumno} 
                        recuperos={recuperos} 
                        solicitudes={solicitudes}
                    />
                )}
                {tabActiva === 'recuperar' && (
                    <TabRecuperar 
                        alumno={alumno} 
                        alumnos={alumnos} 
                        horarios={horarios} 
                        cancelacionesAlumno={cancelacionesAlumno} 
                        recuperos={recuperos} 
                        solicitudes={solicitudes}
                    />
                )}
                {tabActiva === 'miInfo' && (
                    <div className="card">
                        <h3>{alumno.nombre} {alumno.apellido}</h3>
                        <div className="info-row"><span className="label">Email:</span><span>{alumno.email}</span></div>
                        <div className="info-row"><span className="label">Plan:</span><span className="badge badge-info">{alumno.abono.replace('_',' ')}</span></div>
                        <div className="info-row"><span className="label">Clases a recuperar:</span><span className="badge badge-warning">{alumno.clasesPendientes}</span></div>
                    </div>
                )}
            </div>
            <div className="footer"><button onClick={onLogout} className="btn btn-secondary">Cerrar Sesión</button></div>
        </>
    );
}

// --- SUB-COMPONENTES ADMIN ---

function AlumnosTab({ alumnos, onEditar, onNuevo }) {
    return (
        <div>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2>Alumnos</h2>
                <button className="btn btn-primary" onClick={onNuevo}>+ Nuevo Alumno</button>
            </div>
            <div className="grid">
                {alumnos.sort((a,b)=>a.apellido.localeCompare(b.apellido)).map(a => (
                    <div className="card" key={a.id}>
                        <h3>{a.nombre} {a.apellido}</h3>
                        <p style={{fontSize:'0.8rem', color:'#666'}}>{a.email}</p>
                        <div style={{marginTop:'10px'}}>
                            <span className="badge badge-info">{a.abono.replace('_',' ')}</span>
                            {a.clasesPendientes > 0 && <span className="badge badge-warning">{a.clasesPendientes} pend.</span>}
                        </div>
                        <div style={{display:'flex', gap:'5px', marginTop:'15px'}}>
                            <button className="btn btn-primary" style={{flex:1, padding:'8px'}} onClick={()=>onEditar(a)}>Editar</button>
                            <button className="btn btn-danger" style={{flex:1, padding:'8px', fontSize:'0.7rem'}} onClick={()=>FirebaseService.resetearAlumno(a.id)}>Reset Mes</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FormularioAlumno({ alumno, onClose, onSave, horarios, precios }) {
    const [datos, setDatos] = useState(alumno || {
        nombre: '', apellido: '', email: '', abono: '2x_semana',
        clasesTotales: 8, clasesUsadas: 0, clasesPendientes: 0,
        horariosAsignados: [], activo: true
    });

    const toggleHorario = (h) => {
        const actual = datos.horariosAsignados || [];
        setDatos({...datos, horariosAsignados: actual.includes(h) ? actual.filter(x=>x!==h) : [...actual, h]});
    };

    return (
        <Modal onClose={onClose}>
            <h3>{alumno ? 'Editar Alumno' : 'Nuevo Alumno'}</h3>
            <form onSubmit={(e)=>{e.preventDefault(); onSave(datos);}}>
                <div className="form-group"><label>Nombre</label><input value={datos.nombre} onChange={e=>setDatos({...datos, nombre:e.target.value})} required/></div>
                <div className="form-group"><label>Apellido</label><input value={datos.apellido} onChange={e=>setDatos({...datos, apellido:e.target.value})} required/></div>
                <div className="form-group"><label>Email</label><input type="email" value={datos.email} onChange={e=>setDatos({...datos, email:e.target.value})} required/></div>
                <div className="form-group">
                    <label>Plan</label>
                    <select value={datos.abono} onChange={e=>setDatos({...datos, abono:e.target.value})}>
                        {Object.keys(precios).map(p => <option key={p} value={p}>{p.replace('_',' ')}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Horarios Fijos</label>
                    <div style={{maxHeight:'150px', overflowY:'auto', border:'1px solid #eee', padding:'10px', borderRadius:'8px'}}>
                        {Object.keys(horarios).map(dia => (
                            <div key={dia}>
                                <strong>{dia}</strong>
                                <div style={{display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'10px'}}>
                                    {horarios[dia].map(h => (
                                        <button key={h} type="button" 
                                            onClick={()=>toggleHorario(`${dia}-${h}`)}
                                            style={{fontSize:'0.7rem', padding:'4px', background: datos.horariosAsignados.includes(`${dia}-${h}`) ? '#667eea' : '#eee', color: datos.horariosAsignados.includes(`${dia}-${h}`) ? 'white' : 'black', border:'none', borderRadius:'4px'}}
                                        >{h}</button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{width:'100%'}}>Guardar</button>
            </form>
        </Modal>
    );
}

function SolicitudesTab({ solicitudes, alumnos }) {
    const handleAprobar = async (s) => {
        if(!confirm('¿Aprobar este recupero?')) return;
        await FirebaseService.guardarRecupero({...s, estado:'aprobado'});
        await FirebaseService.eliminarSolicitud(s.id);
        const alu = alumnos.find(a => a.id === s.alumnoId);
        if (alu) await FirebaseService.guardarAlumno({...alu, clasesPendientes: Math.max(0, alu.clasesPendientes - 1)});
        alert('Aprobado');
    };

    return (
        <div>
            <h2>Solicitudes de Recupero</h2>
            {solicitudes.length === 0 ? <p>No hay solicitudes pendientes.</p> : (
                <div className="grid">
                    {solicitudes.map(s => (
                        <div className="card" key={s.id}>
                            <h3>{s.alumnoNombre}</h3>
                            <p style={{fontSize:'1.2rem', fontWeight:'bold'}}>{s.fecha.split('-').reverse().join('/')}</p>
                            <p style={{fontSize:'1.5rem'}}>{s.hora} hs</p>
                            <div style={{display:'flex', gap:'5px', marginTop:'15px'}}>
                                <button className="btn btn-success" style={{flex:1}} onClick={()=>handleAprobar(s)}>Aprobar</button>
                                <button className="btn btn-danger" style={{flex:1}} onClick={()=>FirebaseService.eliminarSolicitud(s.id)}>Rechazar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function CalendarioAdminTab({ alumnos, cancelacionesAlumno, recuperos }) {
    return <div className="alert alert-info">Para ver el detalle de asistencia, consultá el calendario semanal en la versión de escritorio o contactá a soporte para la vista móvil extendida.</div>;
}

function HorariosTab({ horarios }) {
    return (
        <div className="grid">
            {Object.keys(horarios).map(dia => (
                <div className="card" key={dia}>
                    <h3>{dia}</h3>
                    {horarios[dia].map(h => <div key={h} className="horario-item"><strong>{h}</strong></div>)}
                </div>
            ))}
        </div>
    );
}

function PreciosTab({ precios }) {
    return (
        <div className="grid">
            {Object.keys(precios).map(p => (
                <div className="card" key={p}>
                    <h3>{p.replace('_',' ').toUpperCase()}</h3>
                    <p style={{fontSize:'2rem', fontWeight:'bold', color:'#667eea'}}>${precios[p].toLocaleString()}</p>
                </div>
            ))}
        </div>
    );
}

// --- SUB-COMPONENTES ALUMNO ---

function CalendarioAlumno({ alumno, cancelacionesAlumno, recuperos, solicitudes }) {
    const hoy = new Date();
    const [mes] = useState(hoy.getMonth());
    const [año] = useState(hoy.getFullYear());

    const handleCancelar = async (diaNombre, hora, fechaStr) => {
        if(!confirm(`¿Cancelar clase del ${diaNombre} ${fechaStr} a las ${hora}?`)) return;
        
        const claseFecha = new Date(`${fechaStr}T${hora}:00`);
        const horasDiff = (claseFecha - new Date()) / (1000 * 60 * 60);
        const puedeRecuperar = horasDiff >= 3;

        await db.collection('cancelacionesAlumno').add({
            alumnoId: alumno.id, alumnoNombre: alumno.nombre, fecha: fechaStr, hora, estado: 'pendiente'
        });

        if(puedeRecuperar) {
            await FirebaseService.guardarAlumno({...alumno, clasesPendientes: alumno.clasesPendientes + 1});
            alert('Cancelada. Tenés 1 clase a recuperar.');
        } else {
            alert('Cancelada fuera de término. No genera clase a recuperar.');
        }
    };

    const misClases = [];
    const diasMes = new Date(año, mes + 1, 0).getDate();
    for(let i=1; i<=diasMes; i++) {
        const f = new Date(año, mes, i);
        const fStr = fechaLocal(f);
        const diaNombre = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][f.getDay()];
        
        // Clases fijos
        alumno.horariosAsignados.forEach(h => {
            const [d, hr] = h.split('-');
            if(d === diaNombre) {
                const cancelada = cancelacionesAlumno.some(c => c.fecha === fStr && c.hora === hr);
                misClases.push({ fecha: fStr, hora: hr, diaNombre, cancelada, tipo:'fija' });
            }
        });
        // Recuperos
        recuperos.filter(r => r.fecha === fStr && r.alumnoId === alumno.id).forEach(r => {
            misClases.push({ fecha: fStr, hora: r.hora, diaNombre, cancelada:false, tipo:'recupero' });
        });
    }

    return (
        <div>
            <h2>Mis Clases de este Mes</h2>
            <div className="grid">
                {misClases.sort((a,b)=>a.fecha.localeCompare(b.fecha)).map((c, idx) => (
                    <div className="card" key={idx} style={{opacity: c.cancelada ? 0.5 : 1}}>
                        <p>{c.diaNombre} {c.fecha.split('-').reverse().join('/')}</p>
                        <h3>{c.hora} hs {c.tipo==='recupero' && '🔄'}</h3>
                        {!c.cancelada && new Date(`${c.fecha}T${c.hora}:00`) > hoy && (
                            <button className="btn btn-danger" onClick={()=>handleCancelar(c.diaNombre, c.hora, c.fecha)}>Cancelar</button>
                        )}
                        {c.cancelada && <span className="badge badge-danger">CANCELADA</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}

function TabRecuperar({ alumno, alumnos, horarios, cancelacionesAlumno, recuperos, solicitudes }) {
    const [slots, setSlots] = useState([]);
    
    useEffect(() => {
        const hoy = new Date();
        const nuevosSlots = [];
        const diasSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

        for(let i=1; i<=14; i++) {
            const f = new Date(); f.setDate(hoy.getDate() + i);
            const fStr = fechaLocal(f);
            const diaNom = diasSemana[f.getDay()];
            const horas = horarios[diaNom] || [];

            horas.forEach(h => {
                const ocupadosReg = alumnos.filter(a => a.horariosAsignados.includes(`${diaNom}-${h}`)).length;
                const cancelados = cancelacionesAlumno.filter(c => c.fecha === fStr && c.hora === h).length;
                const recuperosAprob = recuperos.filter(r => r.fecha === fStr && r.hora === h).length;
                
                const libres = 5 - (ocupadosReg - cancelados + recuperosAprob);
                const yaSolicito = solicitudes.some(s => s.alumnoId === alumno.id && s.fecha === fStr && s.hora === h);
                const yaViene = alumno.horariosAsignados.includes(`${diaNom}-${h}`) && !cancelacionesAlumno.some(c=>c.alumnoId===alumno.id && c.fecha===fStr);

                if(libres > 0 && !yaViene) {
                    nuevosSlots.push({ fecha: fStr, dia: diaNom, hora: h, libres, yaSolicito });
                }
            });
        }
        setSlots(nuevosSlots);
    }, [horarios, alumnos, cancelacionesAlumno]);

    const solicitar = async (s) => {
        if(alumno.clasesPendientes <= 0) { alert('No tenés clases para recuperar.'); return; }
        await FirebaseService.guardarSolicitud({
            alumnoId: alumno.id, alumnoNombre: alumno.nombre, 
            fecha: s.fecha, hora: s.hora, dia: s.dia, estado: 'pendiente'
        });
        alert('Solicitud enviada.');
    };

    return (
        <div>
            <h2>Lugares Disponibles</h2>
            <p>Tenés <strong>{alumno.clasesPendientes}</strong> clases pendientes.</p>
            <div className="grid">
                {slots.map((s, idx) => (
                    <div className="card" key={idx}>
                        <p>{s.dia} {s.fecha.split('-').reverse().join('/')}</p>
                        <h3>{s.hora} hs</h3>
                        <p>{s.libres} lugares</p>
                        {s.yaSolicito ? <span className="badge badge-warning">Enviada</span> : 
                        <button className="btn btn-success" onClick={()=>solicitar(s)}>Solicitar</button>}
                    </div>
                ))}
            </div>
        </div>
    );
}

function Modal({ children, onClose }) {
    return (
        <div className="modal" onClick={onClose}>
            <div className="modal-content" onClick={e=>e.stopPropagation()}>
                {children}
                <button className="btn btn-secondary" style={{width:'100%', marginTop:'10px'}} onClick={onClose}>Cerrar</button>
            </div>
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));