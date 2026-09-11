// src/hooks/usePendingApprovals.js
import { useState, useEffect, useCallback } from 'react';
import { db } from '../config/firebase';
import { 
  collection, 
  query, 
  where, 
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
 */
export function usePendingApprovals() {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setPendingApprovals([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Consulta de aprobaciones donde el usuario es revisor y el estado general es PENDING
    const q = query(
      collection(db, 'approvals'),
      where('reviewerUids', 'array-contains', user.uid),
      where('status', '==', 'PENDING')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const rawDocs = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
          }));

          // Filtrar aquellos donde este revisor específico ya haya emitido su respuesta individual
          const filteredApprovals = [];
          for (const item of rawDocs) {
            try {
              const respDoc = await getDoc(doc(db, 'approvals', item.id, 'responses', user.uid));
              if (respDoc.exists()) {
                const respData = respDoc.data();
                // Si el usuario ya votó APPROVED o REJECTED, ya no está pendiente para él
                if (respData.status === 'APPROVED' || respData.status === 'REJECTED') {
                  continue;
                }
              }
              filteredApprovals.push(item);
            } catch (innerErr) {
              // Si falla leer la subcolección, lo incluimos por seguridad
              filteredApprovals.push(item);
            }
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
        console.error('Error en suscripción a approvals:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  /**
   * Ejecuta una acción de revisión (Aprobar o Rechazar).
   * @param {string} approvalId - ID del documento en approvals.
   * @param {'APPROVED' | 'REJECTED'} decision - Decisión tomada.
   * @param {string} [comment] - Observaciones o comentarios opcionales.
   */
  const submitReviewAction = useCallback(async (approvalId, decision, comment = '') => {
    if (!user?.uid || !approvalId) {
      throw new Error('Usuario no autenticado o ID de aprobación inválido.');
    }

    const cleanComment = (comment || '').trim();

    // 1. Registrar el voto individual del revisor en la subcolección
    const responseRef = doc(db, 'approvals', approvalId, 'responses', user.uid);
    await setDoc(responseRef, {
      status: decision,
      comment: cleanComment,
      reviewerEmail: user.email,
      reviewerName: user.displayName || user.email,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 2. Evaluar el estado global del documento approvals
    const approvalRef = doc(db, 'approvals', approvalId);
    const approvalSnap = await getDoc(approvalRef);

    if (approvalSnap.exists()) {
      const data = approvalSnap.data();
      const reviewerUids = data.reviewerUids || [];

      if (decision === 'REJECTED') {
        // Un solo rechazo marca el documento general como REJECTED
        await updateDoc(approvalRef, {
          status: 'REJECTED',
          rejectedBy: user.email,
          rejectedAt: serverTimestamp(),
          lastComment: cleanComment
        });
      } else if (decision === 'APPROVED') {
        // Verificar si todos los revisores asignados ya aprobaron
        let todosAprobados = true;
        for (const rUid of reviewerUids) {
          if (rUid === user.uid) continue;
          const rSnap = await getDoc(doc(db, 'approvals', approvalId, 'responses', rUid));
          if (!rSnap.exists() || rSnap.data().status !== 'APPROVED') {
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
          `Revisión del documento "${data.title || 'Documento Drive'}": ${decision === 'APPROVED' ? 'Aprobado' : 'Rechazado con Cambios'}${cleanComment ? ` | Observación: "${cleanComment}"` : ''}`
        );
      } catch (logErr) {
        console.warn('No se pudo registrar log de auditoría de revisión:', logErr);
      }
    }

    // Actualizar estado local inmediato para retroalimentación instantánea
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
