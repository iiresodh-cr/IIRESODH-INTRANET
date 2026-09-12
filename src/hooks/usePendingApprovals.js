// src/hooks/usePendingApprovals.js
import { useState, useEffect, useCallback } from 'react';
import { db } from '../config/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { registrarLogAuditoria } from '../utils/auditLogger';

/**
 * Hook que gestiona las aprobaciones pendientes en tiempo real para el usuario autenticado.
 * Diseñado con compatibilidad universal para coincidencias por UID y por correo electrónico.
 */
export function usePendingApprovals() {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.email && !user?.uid) {
      setPendingApprovals([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const userUid = (user.uid || '').toLowerCase().trim();
    const userEmail = (user.email || '').toLowerCase().trim();

    // Escuchar toda la colección de approvals (sin requerir índices compuestos complejos en Firestore)
    const unsubscribe = onSnapshot(
      collection(db, 'approvals'),
      async (snapshot) => {
        try {
          const rawDocs = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
          }));

          const filteredApprovals = [];

          for (const item of rawDocs) {
            // 1. Validar que el estado general sea PENDIENTE (insensible a mayúsculas/minúsculas)
            const rawStatus = String(item.status || 'PENDING').toUpperCase().trim();
            if (rawStatus !== 'PENDING' && rawStatus !== 'PENDIENTE') {
              continue;
            }

            // 2. Extraer todos los posibles campos donde se pudo haber guardado el revisor
            const poolRevisores = [
              ...(Array.isArray(item.reviewerUids) ? item.reviewerUids : []),
              ...(Array.isArray(item.reviewerEmails) ? item.reviewerEmails : []),
              ...(Array.isArray(item.reviewers) ? item.reviewers : []),
              ...(item.reviewerUid ? [item.reviewerUid] : []),
              ...(item.reviewerEmail ? [item.reviewerEmail] : []),
              ...(item.assignedTo ? [item.assignedTo] : []),
              ...(item.revisor ? [item.revisor] : [])
            ].map((r) => String(r).toLowerCase().trim());

            // 3. Comprobar si el usuario actual coincide por UID o por Email
            const isAssigned = poolRevisores.includes(userUid) || poolRevisores.includes(userEmail);
            if (!isAssigned) {
              continue;
            }

            // 4. Comprobar si este revisor ya emitió su voto individual en la subcolección responses
            try {
              if (user.uid) {
                const respUidSnap = await getDoc(doc(db, 'approvals', item.id, 'responses', user.uid));
                if (respUidSnap.exists()) {
                  const status = (respUidSnap.data().status || '').toUpperCase();
                  if (status === 'APPROVED' || status === 'REJECTED') {
                    continue; // Ya votó, ya no es pendiente para él
                  }
                }
              }
            } catch (innerErr) {
              console.warn('Advertencia al consultar subcolección responses:', innerErr);
            }

            filteredApprovals.push(item);
          }

          // Ordenar por fecha de creación descendente
          filteredApprovals.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
          });

          setPendingApprovals(filteredApprovals);
          setError(null);
        } catch (err) {
          console.error('Error al procesar aprobaciones pendientes:', err);
          setError(err);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error en listener onSnapshot de approvals:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, user?.email]);

  /**
   * Ejecuta una acción de revisión (Aprobar o Rechazar).
   * @param {string} approvalId - ID del documento en approvals.
   * @param {'APPROVED' | 'REJECTED'} decision - Decisión tomada.
   * @param {string} [comment] - Observaciones o comentarios opcionales.
   */
  const submitReviewAction = useCallback(async (approvalId, decision, comment = '') => {
    if (!user?.email || !approvalId) {
      throw new Error('Usuario no autenticado o ID de aprobación inválido.');
    }

    const cleanComment = (comment || '').trim();
    const responsePayload = {
      status: decision,
      comment: cleanComment,
      reviewerEmail: user.email,
      reviewerName: user.displayName || user.email,
      reviewerUid: user.uid,
      updatedAt: serverTimestamp()
    };

    // 1. Registrar respuesta tanto por UID como por Email para máxima coherencia
    if (user.uid) {
      await setDoc(doc(db, 'approvals', approvalId, 'responses', user.uid), responsePayload, { merge: true });
    }
    if (user.email) {
      await setDoc(doc(db, 'approvals', approvalId, 'responses', user.email), responsePayload, { merge: true });
    }

    // 2. Evaluar el estado global del documento approvals
    const approvalRef = doc(db, 'approvals', approvalId);
    const approvalSnap = await getDoc(approvalRef);

    if (approvalSnap.exists()) {
      const data = approvalSnap.data();
      const reviewerUids = data.reviewerUids || [];
      const reviewerEmails = data.reviewerEmails || [];
      const pool = [...reviewerUids, ...reviewerEmails];

      if (decision === 'REJECTED') {
        await updateDoc(approvalRef, {
          status: 'REJECTED',
          rejectedBy: user.email,
          rejectedAt: serverTimestamp(),
          lastComment: cleanComment
        });
      } else if (decision === 'APPROVED') {
        let todosAprobados = true;
        // Si hay varios asignados, verificar si todos ya aprobaron
        for (const rev of pool) {
          if (rev === user.uid || rev === user.email) continue;
          const [rSnap1, rSnap2] = await Promise.all([
            getDoc(doc(db, 'approvals', approvalId, 'responses', rev)),
            getDoc(doc(db, 'approvals', approvalId, 'responses', rev.toLowerCase()))
          ]);
          const status1 = rSnap1.exists() ? rSnap1.data().status : null;
          const status2 = rSnap2.exists() ? rSnap2.data().status : null;
          if (status1 !== 'APPROVED' && status2 !== 'APPROVED') {
            todosAprobados = false;
            break;
          }
        }

        if (todosAprobados) {
          await updateDoc(approvalRef, {
            status: 'APPROVED',
            approvedAt: serverTimestamp(),
            lastComment: cleanComment
          });
        }
      }

      // 3. Registrar evento en Logs de Auditoría
      try {
        await registrarLogAuditoria(
          user.email,
          decision === 'APPROVED' ? 'Aprobación de Documento' : 'Rechazo de Documento',
          `Revisión de "${data.title || 'Documento Drive'}": ${decision === 'APPROVED' ? 'Aprobado' : 'Rechazado con Cambios'}${cleanComment ? ` | Observación: "${cleanComment}"` : ''}`
        );
      } catch (logErr) {
        console.warn('No se pudo registrar log de auditoría:', logErr);
      }
    }

    setPendingApprovals((prev) => prev.filter((item) => item.id !== approvalId));
  }, [user]);

  return {
    pendingApprovals,
    pendingCount: pendingApprovals.length,
    loading,
    error,
    submitReviewAction
  };
}
