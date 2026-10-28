import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Registra una acción de auditoría inmutable en Firestore con estándar Enterprise.
 * Soporta tanto la firma posicional `(usuarioEmail, accion, detalles)` como
 * un objeto `{ usuarioEmail, usuario, accion, detalles, modulo, usuarioNombre }`.
 */
export const registrarLogAuditoria = async (usuarioOrObj, accionParam, detallesParam = '') => {
  try {
    let usuarioFinal = 'Sistema';
    let accionFinal = 'Evento de Auditoría';
    let detallesFinal = '';

    if (usuarioOrObj && typeof usuarioOrObj === 'object') {
      usuarioFinal =
        usuarioOrObj.usuarioEmail ||
        usuarioOrObj.usuario ||
        usuarioOrObj.email ||
        'Sistema';
      accionFinal =
        usuarioOrObj.accion ||
        accionParam ||
        'Evento de Auditoría';
      detallesFinal =
        usuarioOrObj.detalles ||
        detallesParam ||
        '';
    } else {
      usuarioFinal = usuarioOrObj || 'Sistema';
      accionFinal = accionParam || 'Evento de Auditoría';
      detallesFinal = detallesParam || '';
    }

    await addDoc(collection(db, 'logs_auditoria'), {
      usuario: String(usuarioFinal),
      accion: String(accionFinal),
      detalles: String(detallesFinal),
      fecha: serverTimestamp()
    });
  } catch (err) {
    console.error('Error crítico e irreversible al intentar escribir en el log de auditoría enterprise:', err);
  }
};
