# DC Control — Pruebas E2E v1

## Infraestructura
- [ ] Backend responde `/api/health` en el servidor central.
- [ ] `DATABASE_URL` apunta a Supabase/PostgreSQL.
- [ ] `DC_AUTH_SECRET` existe en producción.
- [ ] `CORS_ORIGINS` contiene únicamente los orígenes permitidos.
- [ ] Electron usa `VITE_API_BASE_URL` del servidor central.
- [ ] El `.exe` no contiene secretos de Microsoft, SMTP, Teams ni PIN.

## P1 → P2
- [ ] Ventas asignado puede completar P1.
- [ ] P2 requiere confirmación de Ventas.
- [ ] P2 requiere confirmación del Líder Regional.
- [ ] Una confirmación no puede falsificar la otra mediante `user_role/user_name`.
- [ ] Solo con ambas confirmaciones se avanza a P3.

## P3 → P7
- [ ] Líder asignado completa P3.
- [ ] Costos asignado completa P4.
- [ ] Dirección completa P5.
- [ ] Ventas completa P6.
- [ ] Dirección registra P7 como Ganado o Perdido.
- [ ] P3 puede regresar a P2 únicamente con permiso y justificación.
- [ ] P5 puede regresar a P4 únicamente con permiso y justificación.

## Evidencia / reportes
- [ ] Subida de evidencia a SharePoint.
- [ ] Consulta/descarga solo para usuarios autorizados al proyecto.
- [ ] Dossier Word.
- [ ] Minuta P2 prellenada.
- [ ] Reporte ejecutivo.
- [ ] Reporte de desempeño/SLA.
- [ ] Bitácora de auditoría.

## Integraciones
- [ ] Microsoft Graph/SharePoint.
- [ ] SMTP.
- [ ] Teams.
- [ ] Ningún secreto sale en respuestas JSON al Electron.
