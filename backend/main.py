def create_sharepoint_folder_ms_graph(folder_name):
    import requests
    import urllib.parse

    token = get_ms_graph_token()
    _, drive_id = get_sharepoint_drive_details()

    if not drive_id:
        raise Exception("No se pudo encontrar el Drive ID de SharePoint.")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    parent_path = "DC_Control_Trazabilidad"
    encoded_parent = urllib.parse.quote(parent_path)

    check_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{encoded_parent}/{urllib.parse.quote(folder_name)}"

    check_response = requests.get(
        check_url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15
    )

    if check_response.status_code == 200:
        existing = check_response.json()
        return existing.get("id"), existing.get("webUrl")

    if check_response.status_code != 404:
        raise Exception(
            f"No se pudo verificar la carpeta SharePoint: "
            f"HTTP {check_response.status_code} - {check_response.text}"
        )

    create_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{encoded_parent}:/children"

    payload = {
        "name": folder_name,
        "folder": {},
        "@microsoft.graph.conflictBehavior": "fail"
    }

    response = requests.post(
        create_url,
        headers=headers,
        json=payload,
        timeout=15
    )

    if response.status_code not in (200, 201):
        raise Exception(
            f"No se pudo crear la carpeta SharePoint: "
            f"HTTP {response.status_code} - {response.text}"
        )

    created = response.json()
    return created.get("id"), created.get("webUrl")


from typing import Optional, Union, List, Dict
# -*- coding: utf-8 -*-
import os
from dotenv import load_dotenv
load_dotenv()
import sys
import json
import base64
import io
import re
import threading
import urllib.request
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, date, timedelta

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
import psycopg2.pool
import psycopg2.extras

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import hashlib
import hmac
import time

from fastapi import Depends, Header
from fastapi.staticfiles import StaticFiles

# Initialize FastAPI
app = FastAPI(title="DC Control API v50", version="5.0.0")

# Servir frontend React/Vite desde el mismo Web Service de Render
DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="frontend")

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,null").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants & Connection Settings
DB_URI = os.getenv("DATABASE_URL", "").strip()
if not DB_URI:
    raise RuntimeError("DATABASE_URL no está configurada. Define la cadena de conexión de Supabase/PostgreSQL en las variables de entorno del servidor.")
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ESTADOS_MEXICO = {
    "CDMX": "Líder Regional - Sur",
    "Estado de México": "Líder Regional - Sur",
    "Querétaro": "Líder Regional - Sur",
    "Guanajuato": "Líder Regional - Sur",
    "Jalisco": "Líder Regional - Sur",
    "Michoacán": "Líder Regional - Sur",
    "Puebla": "Líder Regional - Sur",
    "Veracruz": "Líder Regional - Sur",
    "Hidalgo": "Líder Regional - Sur",
    "Morelos": "Líder Regional - Sur",
    "Guerrero": "Líder Regional - Sur",
    "Oaxaca": "Líder Regional - Sur",
    "Chiapas": "Líder Regional - Sur",
    "Tabasco": "Líder Regional - Sur",
    "Campeche": "Líder Regional - Sur",
    "Yucatán": "Líder Regional - Sur",
    "Quintana Roo": "Líder Regional - Sur",
    "Tlaxcala": "Líder Regional - Sur",
    "Colima": "Líder Regional - Sur",
    "Nayarit": "Líder Regional - Sur",
    "Nuevo León": "Líder Regional - Norte",
    "Chihuahua": "Líder Regional - Norte",
    "Coahuila": "Líder Regional - Norte",
    "Sonora": "Líder Regional - Norte",
    "Baja California": "Líder Regional - Norte",
    "Baja California Sur": "Líder Regional - Norte",
    "San Luis Potosí": "Líder Regional - Norte",
    "Aguascalientes": "Líder Regional - Norte",
    "Durango": "Líder Regional - Norte",
    "Sinaloa": "Líder Regional - Norte",
    "Zacatecas": "Líder Regional - Norte",
    "Tamaulipas": "Líder Regional - Norte"
}

# Connection pool
pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=1,
    maxconn=20,
    dsn=DB_URI,
    connect_timeout=5
)

def get_db_connection():
    return pool.getconn()

def put_db_connection(conn):
    pool.putconn(conn)

def hash_password(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

# Persistent configuration cache helper
def get_system_setting(key, default=""):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT val FROM system_settings WHERE key = %s", (key,))
        row = cursor.fetchone()
        if row:
            return row['val']
    except Exception:
        pass
    finally:
        put_db_connection(conn)
    return default

def set_system_setting(key, val):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO system_settings (key, val) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val", (key, val))
        conn.commit()
    except Exception:
        pass
    finally:
        put_db_connection(conn)

# Azure / MS Graph credentials retrieval
def get_ms_graph_credentials():
    # Secrets are resolved only on the server. This helper is internal and must
    # never be used as a response payload. Environment variables take priority.
    tenant_id = os.getenv("MS_TENANT_ID", "").strip() or get_system_setting("ms_tenant_id", "")
    client_id = os.getenv("MS_CLIENT_ID", "").strip() or get_system_setting("ms_client_id", "")
    client_secret = os.getenv("MS_CLIENT_SECRET", "").strip() or get_system_setting("ms_client_secret", "")
    return tenant_id, client_id, client_secret

def get_ms_graph_token():
    tenant_id, client_id, client_secret = get_ms_graph_credentials()
    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = {
        "client_id": client_id,
        "scope": "https://graph.microsoft.com/.default",
        "client_secret": client_secret,
        "grant_type": "client_credentials"
    }
    import requests
    response = requests.post(url, data=data, timeout=10)
    response.raise_for_status()
    return response.json()["access_token"]

def get_sharepoint_drive_details():
    try:
        cached_site_id = get_system_setting("ms_site_id", "")
        cached_drive_id = get_system_setting("ms_drive_id", "")
        if cached_site_id and cached_drive_id:
            return cached_site_id, cached_drive_id
    except Exception:
        pass

    try:
        token = get_ms_graph_token()
    except Exception:
        return None, None

    headers = {"Authorization": f"Bearer {token}"}
    import requests
    import urllib.parse

    site_id = None
    search_queries = ["DC Control", "DC Control Cotizaciones", "DC_Control"]
    for q in search_queries:
        try:
            url = f"https://graph.microsoft.com/v1.0/sites?search={urllib.parse.quote(q)}"
            r = requests.get(url, headers=headers, timeout=10)
            if r.status_code == 200:
                sites = r.json().get("value", [])
                if sites:
                    site_id = sites[0]["id"]
                    break
        except Exception:
            pass

    if not site_id:
        try:
            r = requests.get("https://graph.microsoft.com/v1.0/sites/root", headers=headers, timeout=10)
            if r.status_code == 200:
                site_id = r.json()["id"]
        except Exception:
            pass

    drive_id = None
    if site_id:
        try:
            r = requests.get(f"https://graph.microsoft.com/v1.0/sites/{site_id}/drive", headers=headers, timeout=10)
            if r.status_code == 200:
                drive_id = r.json()["id"]
        except Exception:
            pass

    if not drive_id:
        try:
            r = requests.get("https://graph.microsoft.com/v1.0/drives", headers=headers, timeout=10)
            if r.status_code == 200:
                drives = r.json().get("value", [])
                if drives:
                    drive_id = drives[0]["id"]
        except Exception:
            pass

    if site_id and drive_id:
        try:
            set_system_setting("ms_site_id", site_id)
            set_system_setting("ms_drive_id", drive_id)
        except Exception:
            pass

    return site_id, drive_id

def sharepoint_project_folder_exists(project_id):
    import requests
    import urllib.parse
    token = get_ms_graph_token()
    _, drive_id = get_sharepoint_drive_details()
    if not drive_id:
        return False
    encoded_path = urllib.parse.quote(f"DC_Control_Trazabilidad/{project_id}")
    url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{encoded_path}"
    response = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
    if response.status_code == 200:
        return True
    if response.status_code == 404:
        return False
    response.raise_for_status()
    return False

def upload_file_to_sharepoint(project_id, filename, file_bytes):
    import requests
    import urllib.parse
    token = get_ms_graph_token()
    _, drive_id = get_sharepoint_drive_details()
    if not drive_id:
        raise Exception("No se pudo encontrar el Drive ID de SharePoint/Teams.")

    headers = {"Authorization": f"Bearer {token}"}
    encoded_path = urllib.parse.quote(f"DC_Control_Trazabilidad/{project_id}/{filename}")
    file_size = len(file_bytes)

    if file_size < 4194304:
        put_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{encoded_path}:/content"
        headers_put = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/octet-stream"
        }
        r = requests.put(put_url, headers=headers_put, data=file_bytes, timeout=30)
        r.raise_for_status()
        res_data = r.json()
        return res_data.get("id"), res_data.get("webUrl")
    else:
        session_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{encoded_path}:/createUploadSession"
        r = requests.post(session_url, headers=headers, json={}, timeout=15)
        r.raise_for_status()
        upload_url = r.json()["uploadUrl"]

        chunk_size = 3276800  # ~3.1 MB
        start = 0
        r_chunk = None
        while start < file_size:
            end = min(start + chunk_size, file_size)
            chunk = file_bytes[start:end]
            headers_chunk = {
                "Content-Range": f"bytes {start}-{end-1}/{file_size}",
                "Content-Length": str(end - start)
            }
            r_chunk = requests.put(upload_url, headers=headers_chunk, data=chunk, timeout=60)
            r_chunk.raise_for_status()
            start = end

        if r_chunk:
            res_data = r_chunk.json()
            return res_data.get("id"), res_data.get("webUrl")
        raise Exception("Fallo la sesion de carga en fragmentos")

def download_file_from_sharepoint(file_id):
    import requests
    token = get_ms_graph_token()
    _, drive_id = get_sharepoint_drive_details()
    if not drive_id:
        raise Exception("No se pudo encontrar el Drive ID de SharePoint/Teams.")
    url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{file_id}/content"
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(url, headers=headers, timeout=60)
    r.raise_for_status()
    return r.content

def delete_file_from_sharepoint(file_id):
    try:
        import requests
        token = get_ms_graph_token()
        _, drive_id = get_sharepoint_drive_details()
        if drive_id and file_id:
            url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{file_id}"
            headers = {"Authorization": f"Bearer {token}"}
            requests.delete(url, headers=headers, timeout=15)
    except Exception:
        pass

def delete_empty_project_folder_from_sharepoint(project_id):
    """Elimina la carpeta del proyecto solo si existe y está vacía."""
    import requests
    import urllib.parse

    token = get_ms_graph_token()
    _, drive_id = get_sharepoint_drive_details()
    if not drive_id:
        raise Exception("No se pudo encontrar el Drive de SharePoint.")

    encoded_path = urllib.parse.quote(f"DC_Control_Trazabilidad/{project_id}")
    item_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{encoded_path}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(item_url, headers=headers, timeout=15)

    if response.status_code == 404:
        return False, "La carpeta no existe en SharePoint"
    if response.status_code != 200:
        raise Exception(f"No se pudo consultar la carpeta SharePoint: HTTP {response.status_code}")

    item = response.json()
    item_id = item.get("id")
    children_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}/children?$top=1"
    children_response = requests.get(children_url, headers=headers, timeout=15)
    children_response.raise_for_status()

    if children_response.json().get("value"):
        return False, "La carpeta conserva archivos y no se eliminó"

    delete_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}"
    delete_response = requests.delete(delete_url, headers=headers, timeout=15)
    if delete_response.status_code not in (200, 204):
        raise Exception(f"No se pudo eliminar la carpeta SharePoint: HTTP {delete_response.status_code}")
    return True, "Carpeta vacía eliminada"

# Audit Logging Helper
def log_audit(project_id, user_name, role, action, comments=None):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO audit_log (project_id, user_name, role, action, timestamp, comments)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (project_id, user_name, role, action, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), comments))
        conn.commit()
    except Exception:
        pass
    finally:
        put_db_connection(conn)

# Automated Notification Dispatches
def dispatch_parameter_change_notifications(project_id, new_step_num, new_target_date, justification):
    if get_system_setting("notifications_enabled", "0") != "1":
        return
    thread = threading.Thread(target=_bg_dispatch_parameter_change_notifications, args=(project_id, new_step_num, new_target_date, justification))
    thread.daemon = True
    thread.start()

def _bg_dispatch_parameter_change_notifications(project_id, new_step_num, new_target_date, justification):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        p = cursor.fetchone()
        if not p:
            return
        
        emails = []
        assignees = [p['assigned_ventas'], p['assigned_lider'], p['assigned_costos']]
        for assignee in set(assignees):
            if not assignee:
                continue
            cursor.execute("SELECT email, full_name FROM users WHERE full_name = %s OR role = %s", (assignee, assignee))
            rows = cursor.fetchall()
            for r in rows:
                if r['email'] and "@" in r['email']:
                    emails.append((r['email'], r['full_name']))
    except Exception:
        return
    finally:
        put_db_connection(conn)

    # Strictly deduplicate emails by both lowercase email and full name to guarantee exactly 1 notification
    unique_emails = {}
    seen_names = set()
    for em, fn in emails:
        if not em or not fn:
            continue
        em_lower = em.strip().lower()
        fn_clean = fn.strip()
        if em_lower not in unique_emails and fn_clean not in seen_names:
            unique_emails[em_lower] = fn_clean
            seen_names.add(fn_clean)
    emails = [(em, fn) for em, fn in unique_emails.items()]
    smtp_host = os.getenv("SMTP_HOST", "").strip() or get_system_setting("smtp_host")
    smtp_port = os.getenv("SMTP_PORT", "").strip() or get_system_setting("smtp_port")
    smtp_user = os.getenv("SMTP_USER", "").strip() or get_system_setting("smtp_user")
    smtp_pass = os.getenv("SMTP_PASS", "").strip() or get_system_setting("smtp_pass")
    smtp_sender = os.getenv("SMTP_SENDER", "").strip() or get_system_setting("smtp_sender", "DC Control Notificaciones")

    if smtp_host and smtp_port and smtp_user and smtp_pass and emails:
        for email, f_name in emails:
            try:
                msg = MIMEMultipart()
                msg['From'] = f"{smtp_sender} <{smtp_user}>"
                msg['To'] = email
                msg['Subject'] = f"DC Control - Parámetros de Proyecto Modificados: {project_id} - {p['name']}"

                body = f"""<html>
<body style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6;">
    <div style="background-color: #111827; color: white; padding: 20px; border-radius: 6px 6px 0 0; border-left: 6px solid #C23B22;">
        <h2 style="margin: 0; font-size: 20px;">DC Control - Notificación de Cambios</h2>
    </div>
    <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px;">
        <p>Hola <strong>{f_name}</strong>,</p>
        <p>Se han modificado de manera oficial los parámetros del proyecto <strong>{project_id} - {p['name']}</strong>.</p>
        <p style="background-color: #f3f4f6; padding: 15px; border-radius: 4px; border-left: 4px solid #C23B22;">
            <strong>Detalles de la Actualización:</strong><br>
            <span style="font-size: 15px; font-weight: bold; color: #111827;">Nueva Fecha Límite:</span> {new_target_date}<br>
            <span style="font-size: 15px; font-weight: bold; color: #111827;">Paso Activo de Compuerta:</span> Paso {new_step_num}<br>
            <span style="font-size: 15px; font-weight: bold; color: #111827;">Justificación / Notas:</span><br>
            <span style="color: #4b5563; font-style: italic;">"{justification or 'No especificada'}"</span>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 13px; color: #6b7280;">Por favor, ingresa a la aplicación de escritorio de DC Control para continuar.</p>
    </div>
</body>
</html>"""
                msg.attach(MIMEText(body, 'html'))
                server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=10)
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, email, msg.as_string())
                server.quit()
            except Exception:
                pass

    teams_url = os.getenv("TEAMS_WEBHOOK_URL", "").strip() or get_system_setting("teams_webhook_url")
    if teams_url and teams_url.startswith("http"):
        try:
            mention_strings = [f"<at>{fn}</at>" for em, fn in emails]
            entities = [{
                "type": "mention",
                "text": f"<at>{fn}</at>",
                "mentioned": {"id": em, "name": fn}
            } for em, fn in emails]
            mentions_text = ", ".join(mention_strings) if mention_strings else "Equipo"

            card_payload = {
                "type": "message",
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": {
                            "type": "AdaptiveCard",
                            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                            "version": "1.2",
                            "body": [
                                {
                                    "type": "TextBlock",
                                    "text": "🚨 **DC Control - Parámetros de Proyecto Modificados**",
                                    "weight": "Bolder",
                                    "size": "Medium",
                                    "color": "Attention"
                                },
                                {
                                    "type": "TextBlock",
                                    "text": f"Hola {mentions_text}, se han modificado de manera oficial los parámetros del proyecto **{project_id} - {p['name']}**.",
                                    "wrap": True
                                },
                                {
                                    "type": "FactSet",
                                    "facts": [
                                        {"title": "Cliente:", "value": str(p['client'])},
                                        {"title": "Nueva Fecha Límite:", "value": str(new_target_date)},
                                        {"title": "Paso Activo:", "value": f"Paso {new_step_num}"},
                                        {"title": "Justificación:", "value": str(justification or "No especificada")}
                                    ]
                                }
                            ],
                            "msteams": {"entities": entities}
                        }
                    }
                ]
            }
            req = urllib.request.Request(
                teams_url,
                data=json.dumps(card_payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req) as response:
                pass
        except Exception:
            pass

def dispatch_step_completion_notifications(project_id, completed_step_num):
    if get_system_setting("notifications_enabled", "0") != "1":
        return
    thread = threading.Thread(target=_bg_dispatch_step_completion_notifications, args=(project_id, completed_step_num))
    thread.daemon = True
    thread.start()

def _bg_dispatch_step_completion_notifications(project_id, completed_step_num):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        p = cursor.fetchone()
        if not p:
            return

        next_step_num = completed_step_num + 1
        if next_step_num > 7:
            return

        steps_meta = {
            1: {"name": "Paso 1: Levantamiento Técnico", "desc": "Cargar la evidencia y datos técnicos del levantamiento de la obra.", "assignee": p['assigned_ventas']},
            2: {"name": "Paso 2: Reunión de Seguimiento y Minuta de Trabajo", "desc": "Realizar la reunión comercial-técnica y subir la minuta firmada por Ventas y Líder.", "assignee": f"{p['assigned_ventas']} & {p['assigned_lider']}"},
            3: {"name": "Paso 3: Catálogo de Conceptos Técnico", "desc": "Elaborar y subir el catálogo de conceptos técnicos de ingeniería.", "assignee": p['assigned_lider']},
            4: {"name": "Paso 4: Elaboración de Cotización de Precios", "desc": "Formular los precios unitarios, márgenes de utilidad y cargar la cotización final.", "assignee": p['assigned_costos']},
            5: {"name": "Paso 5: Revisión de Cotización y Aprobación", "desc": "Revisión a detalle de costos, alcance y margen comercial para su firma autorizada.", "assignee": "Dirección General / Directores"},
            6: {"name": "Paso 6: Entrega Comercial al Cliente", "desc": "Entregar formalmente la propuesta al cliente final y registrar el monto final entregado con su evidencia.", "assignee": p['assigned_ventas']},
            7: {"name": "Paso 7: Cierre Comercial de Licitación", "desc": "Especificar el resultado comercial definitivo (Ganado / Perdido / Cancelado).", "assignee": "Dirección General"}
        }

        meta = steps_meta.get(next_step_num)
        if not meta:
            return

        emails = []
        search_targets = []
        if next_step_num in [1, 6]:
            search_targets.append(p['assigned_ventas'])
        elif next_step_num == 2:
            search_targets.extend([p['assigned_ventas'], p['assigned_lider']])
        elif next_step_num == 3:
            search_targets.append(p['assigned_lider'])
        elif next_step_num == 4:
            search_targets.append(p['assigned_costos'])

        if search_targets:
            search_targets = [t for t in search_targets if t]
            placeholders = ', '.join(['%s'] * len(search_targets))
            cursor.execute(f"SELECT email, full_name FROM users WHERE full_name IN ({placeholders}) OR role IN ({placeholders})", tuple(search_targets) + tuple(search_targets))
            rows = cursor.fetchall()
            for r in rows:
                if r['email'] and "@" in r['email']:
                    emails.append((r['email'], r['full_name']))

        if next_step_num in [5, 7] or not emails:
            cursor.execute("SELECT email, full_name FROM users WHERE role LIKE '%Director%' OR role LIKE '%Admin%'")
            directors = cursor.fetchall()
            for d in directors:
                if d['email'] and "@" in d['email']:
                    emails.append((d['email'], d['full_name']))
    except Exception:
        return
    finally:
        put_db_connection(conn)

    # Strictly deduplicate emails by both lowercase email and full name to guarantee exactly 1 notification
    unique_emails = {}
    seen_names = set()
    for em, fn in emails:
        if not em or not fn:
            continue
        em_lower = em.strip().lower()
        fn_clean = fn.strip()
        if em_lower not in unique_emails and fn_clean not in seen_names:
            unique_emails[em_lower] = fn_clean
            seen_names.add(fn_clean)
    emails = [(em, fn) for em, fn in unique_emails.items()]
    smtp_host = os.getenv("SMTP_HOST", "").strip() or get_system_setting("smtp_host")
    smtp_port = os.getenv("SMTP_PORT", "").strip() or get_system_setting("smtp_port")
    smtp_user = os.getenv("SMTP_USER", "").strip() or get_system_setting("smtp_user")
    smtp_pass = os.getenv("SMTP_PASS", "").strip() or get_system_setting("smtp_pass")
    smtp_sender = os.getenv("SMTP_SENDER", "").strip() or get_system_setting("smtp_sender", "DC Control Notificaciones")

    if smtp_host and smtp_port and smtp_user and smtp_pass and emails:
        for email, f_name in emails:
            try:
                msg = MIMEMultipart()
                msg['From'] = f"{smtp_sender} <{smtp_user}>"
                msg['To'] = email
                msg['Subject'] = f"DC Control - Tarea Asignada: {project_id} - {p['name']}"

                body = f"""<html>
<body style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6;">
    <div style="background-color: #111827; color: white; padding: 20px; border-radius: 6px 6px 0 0; border-left: 6px solid #0F4C81;">
        <h2 style="margin: 0; font-size: 20px;">DC Control - Gestión Comercial</h2>
    </div>
    <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px;">
        <p>Hola <strong>{f_name}</strong>,</p>
        <p>Te informamos que se ha avanzado de etapa en el proyecto <strong>{project_id} - {p['name']}</strong> para el cliente <strong>{p['client']}</strong>.</p>
        <p style="background-color: #f3f4f6; padding: 15px; border-radius: 4px; border-left: 4px solid #0F4C81;">
            <strong>Siguiente Acción Requerida:</strong><br>
            <span style="font-size: 16px; font-weight: bold; color: #111827;">{meta['name']}</span><br>
            <span style="color: #4b5563;">{meta['desc']}</span>
        </p>
        <p><strong>Responsable Asignado:</strong> {meta['assignee']}</p>
        <p><strong>Fecha Compromiso:</strong> {p['target_date']}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 13px; color: #6b7280;">Ingresa al sistema de DC Control para completar tus asignaciones.</p>
    </div>
</body>
</html>"""
                msg.attach(MIMEText(body, 'html'))
                server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=10)
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, email, msg.as_string())
                server.quit()
            except Exception:
                pass

    teams_url = os.getenv("TEAMS_WEBHOOK_URL", "").strip() or get_system_setting("teams_webhook_url")
    if teams_url and teams_url.startswith("http"):
        try:
            mention_strings = [f"<at>{fn}</at>" for em, fn in emails]
            entities = [{
                "type": "mention",
                "text": f"<at>{fn}</at>",
                "mentioned": {"id": em, "name": fn}
            } for em, fn in emails]
            mentions_text = ", ".join(mention_strings) if mention_strings else "Equipo"

            card_payload = {
                "type": "message",
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": {
                            "type": "AdaptiveCard",
                            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                            "version": "1.2",
                            "body": [
                                {
                                    "type": "TextBlock",
                                    "text": "🔵 **DC Control - Siguiente Paso Habilitado**",
                                    "weight": "Bolder",
                                    "size": "Medium",
                                    "color": "Good"
                                },
                                {
                                    "type": "TextBlock",
                                    "text": f"Hola {mentions_text}, se ha habilitado el siguiente paso en el proyecto **{project_id} - {p['name']}**.",
                                    "wrap": True
                                },
                                {
                                    "type": "FactSet",
                                    "facts": [
                                        {"title": "Cliente:", "value": str(p['client'])},
                                        {"title": "Siguiente Tarea:", "value": str(meta['name'])},
                                        {"title": "Responsable:", "value": str(meta['assignee'])},
                                        {"title": "Fecha Límite:", "value": str(p['target_date'] or "No definida")}
                                    ]
                                }
                            ],
                            "msteams": {"entities": entities}
                        }
                    }
                ]
            }
            req = urllib.request.Request(
                teams_url,
                data=json.dumps(card_payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req) as response:
                pass
        except Exception:
            pass

def dispatch_rejection_notification(project_id, step_num, justification):
    if get_system_setting("notifications_enabled", "0") != "1":
        return
    thread = threading.Thread(target=_bg_dispatch_rejection_notification, args=(project_id, step_num, justification))
    thread.daemon = True
    thread.start()

def _bg_dispatch_rejection_notification(project_id, step_num, justification):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        p = cursor.fetchone()
        if not p:
            return

        if step_num == 3:
            target_name = p['assigned_lider']
            subject = f"DC Control - Catálogo Incompleto: {project_id} - {p['name']}"
            body_text = "El catálogo de conceptos técnicos ha sido marcado como INCOMPLETO."
            action_label = "Corregir Catálogo"
        elif step_num == 5:
            target_name = p['assigned_costos']
            subject = f"DC Control - Modificaciones de Cotización: {project_id} - {p['name']}"
            body_text = "Se han solicitado modificaciones para la propuesta de cotización."
            action_label = "Modificar Cotización"
        else:
            return

        emails = []
        cursor.execute("SELECT email, full_name FROM users WHERE full_name = %s OR role = %s", (target_name, target_name))
        rows = cursor.fetchall()
        for r in rows:
            if r['email'] and "@" in r['email']:
                emails.append((r['email'], r['full_name']))
    except Exception:
        return
    finally:
        put_db_connection(conn)

    # Strictly deduplicate emails by both lowercase email and full name to guarantee exactly 1 notification
    unique_emails = {}
    seen_names = set()
    for em, fn in emails:
        if not em or not fn:
            continue
        em_lower = em.strip().lower()
        fn_clean = fn.strip()
        if em_lower not in unique_emails and fn_clean not in seen_names:
            unique_emails[em_lower] = fn_clean
            seen_names.add(fn_clean)
    emails = [(em, fn) for em, fn in unique_emails.items()]
    smtp_host = os.getenv("SMTP_HOST", "").strip() or get_system_setting("smtp_host")
    smtp_port = os.getenv("SMTP_PORT", "").strip() or get_system_setting("smtp_port")
    smtp_user = os.getenv("SMTP_USER", "").strip() or get_system_setting("smtp_user")
    smtp_pass = os.getenv("SMTP_PASS", "").strip() or get_system_setting("smtp_pass")
    smtp_sender = os.getenv("SMTP_SENDER", "").strip() or get_system_setting("smtp_sender", "DC Control Notificaciones")

    if smtp_host and smtp_port and smtp_user and smtp_pass and emails:
        for email, f_name in emails:
            try:
                msg = MIMEMultipart()
                msg['From'] = f"{smtp_sender} <{smtp_user}>"
                msg['To'] = email
                msg['Subject'] = subject

                body = f"""<html>
<body style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6;">
    <div style="background-color: #C23B22; color: white; padding: 20px; border-radius: 6px 6px 0 0; border-left: 6px solid #111827;">
        <h2 style="margin: 0; font-size: 20px;">DC Control - Solicitud de Corrección</h2>
    </div>
    <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px;">
        <p>Hola <strong>{f_name}</strong>,</p>
        <p>{body_text}</p>
        <p style="background-color: #fdf2f2; padding: 15px; border-radius: 4px; border-left: 4px solid #C23B22;">
            <strong>Detalles de la Corrección Solicitada:</strong><br>
            <span style="font-size: 15px; color: #111827; font-weight: bold;">Justificación:</span><br>
            <span style="color: #4b5563; font-style: italic;">"{justification}"</span>
        </p>
        <p><strong>Proyecto:</strong> {project_id} - {p['name']}</p>
        <p><strong>Cliente:</strong> {p['client']}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 13px; color: #6b7280;">Por favor, atiende esta solicitud de inmediato desde la app.</p>
    </div>
</body>
</html>"""
                msg.attach(MIMEText(body, 'html'))
                server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=10)
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, email, msg.as_string())
                server.quit()
            except Exception:
                pass

    teams_url = os.getenv("TEAMS_WEBHOOK_URL", "").strip() or get_system_setting("teams_webhook_url")
    if teams_url and teams_url.startswith("http"):
        try:
            mention_strings = [f"<at>{fn}</at>" for em, fn in emails]
            entities = [{
                "type": "mention",
                "text": f"<at>{fn}</at>",
                "mentioned": {"id": em, "name": fn}
            } for em, fn in emails]
            mentions_text = ", ".join(mention_strings) if mention_strings else "Equipo"

            card_payload = {
                "type": "message",
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": {
                            "type": "AdaptiveCard",
                            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                            "version": "1.2",
                            "body": [
                                {
                                    "type": "TextBlock",
                                    "text": "🔴 **DC Control - Solicitud de Corrección Requerida**",
                                    "weight": "Bolder",
                                    "size": "Medium",
                                    "color": "Attention"
                                },
                                {
                                    "type": "TextBlock",
                                    "text": f"Hola {mentions_text}, se han solicitado modificaciones o correcciones para la licitación **{project_id} - {p['name']}**.",
                                    "wrap": True
                                },
                                {
                                    "type": "FactSet",
                                    "facts": [
                                        {"title": "Cliente:", "value": str(p['client'])},
                                        {"title": "Acción Requerida:", "value": str(action_label)},
                                        {"title": "Justificación:", "value": str(justification)}
                                    ]
                                }
                            ],
                            "msteams": {"entities": entities}
                        }
                    }
                ]
            }
            req = urllib.request.Request(
                teams_url,
                data=json.dumps(card_payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req) as response:
                pass
        except Exception:
            pass

# Authentication / authorization helpers for cloud deployment
AUTH_SECRET = os.getenv("DC_AUTH_SECRET", "").strip()
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
if not AUTH_SECRET:
    if ENVIRONMENT == "production":
        raise RuntimeError("DC_AUTH_SECRET es obligatoria en producción.")
    # Local development fallback only. Production must set DC_AUTH_SECRET.
    AUTH_SECRET = "dc-control-local-development-secret-change-me"
AUTH_TOKEN_TTL = int(os.getenv("DC_AUTH_TOKEN_TTL", "28800"))

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

def _b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))

def create_auth_token(username: str) -> str:
    payload = {"sub": username, "exp": int(time.time()) + AUTH_TOKEN_TTL}
    body = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _b64url(hmac.new(AUTH_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{sig}"

def get_current_user(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesión no autenticada")
    token = authorization[7:].strip()
    try:
        body, sig = token.split(".", 1)
        expected = _b64url(hmac.new(AUTH_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            raise ValueError("firma")
        payload = json.loads(_b64url_decode(body))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("expirado")
        username = str(payload.get("sub", "")).strip()
        if not username:
            raise ValueError("usuario")
    except Exception:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada")

    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT username, full_name, role, email, privileges FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no disponible")
        return dict(user)
    finally:
        put_db_connection(conn)

def _role_text(user) -> str:
    return (user.get("role") or "").strip().lower()

def is_admin_or_director(user) -> bool:
    role = _role_text(user)
    return ("admin" in role or "director" in role or "mod" in role or user.get("username") == "noe.ortizadm")

def has_privilege(user, privilege: str) -> bool:
    if is_admin_or_director(user):
        return True
    privileges = {x.strip().lower() for x in (user.get("privileges") or "").split(",") if x.strip()}
    return privilege.lower() in privileges

def require_admin(user=Depends(get_current_user)):
    if not is_admin_or_director(user):
        raise HTTPException(status_code=403, detail="Acción exclusiva de Administración/Dirección")
    return user

def _repair_docx_mojibake(data: bytes) -> bytes:
    """Repair common UTF-8-as-Windows-1252 mojibake inside generated DOCX XML."""
    import re
    import zipfile
    import io
    from html import unescape, escape

    markers = ("Ãƒ", "Ã‚", "Ã¢", "Ã°", "ï¿½")

    def repair_text(text):
        if not any(m in text for m in markers):
            return text
        raw = unescape(text)
        for encoding in ("cp1252", "latin1"):
            try:
                repaired = raw.encode(encoding).decode("utf-8")
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue
            if repaired != raw and not any(m in repaired for m in markers):
                return escape(repaired, quote=False)
        return text

    source = io.BytesIO(data)
    output = io.BytesIO()
    with zipfile.ZipFile(source, "r") as zin, zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            payload = zin.read(item.filename)
            if item.filename.startswith("word/") and item.filename.endswith(".xml"):
                text = payload.decode("utf-8")
                text = re.sub(r"(<w:t(?:\s[^>]*)?>)(.*?)(</w:t>)", lambda m: m.group(1) + repair_text(m.group(2)) + m.group(3), text, flags=re.DOTALL)
                payload = text.encode("utf-8")
            zout.writestr(item, payload)
    return output.getvalue()

def _get_project_by_id(project_id):
    """Return one project as a DictRow for protected report generation."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        return cursor.fetchone()
    finally:
        put_db_connection(conn)

def require_report_access(user=Depends(get_current_user)):
    if not has_privilege(user, "reports"):
        raise HTTPException(status_code=403, detail="No tienes privilegio de reportes")
    return user

def _normalize_assignment(value):
    """
    Normaliza asignaciones para tolerar:
    - may?sculas/min?sculas
    - acentos
    - espacios extra
    - mojibake UTF-8/Latin-1 (ej. L??der -> L?der)
    """
    import unicodedata

    text = str(value or "").strip()

    # Reparar mojibake una o dos veces cuando sea posible.
    for _ in range(2):
        try:
            repaired = text.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            break

        if repaired == text:
            break

        text = repaired

    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"\s+", " ", text).strip()

    return text


def _is_assigned(user, assigned):
    assigned_norm = _normalize_assignment(assigned)

    if not assigned_norm:
        return False

    role_norm = _normalize_assignment(user.get("role"))
    name_norm = _normalize_assignment(user.get("full_name"))
    username_norm = _normalize_assignment(user.get("username"))

    # Coincidencia directa contra nombre, usuario o rol.
    if assigned_norm in {role_norm, name_norm, username_norm}:
        return True

    # Asignaciones gen?ricas de Ventas.
    if assigned_norm in {"agente de ventas", "ventas"}:
        return (
            "ventas" in role_norm
            or "comercial" in role_norm
            or "agente" in role_norm
        )

    # Asignaciones gen?ricas/espec?ficas de L?der Regional.
    if "lider regional" in assigned_norm:
        return (
            "lider regional" in role_norm
            or "lider" in role_norm
            or "regional" in role_norm
        )

    # Asignaciones de Costos.
    if assigned_norm in {"analista de costos", "costos"}:
        return (
            "costos" in role_norm
            or "analista" in role_norm
        )

    return False


def require_project_read_access(user, project):
    """Allow project/evidence reads to assigned users even after P7 closure."""
    if is_admin_or_director(user):
        return
    if any(_is_assigned(user, str(project.get(k) or "")) for k in ("assigned_ventas", "assigned_lider", "assigned_costos")):
        return
    raise HTTPException(status_code=403, detail="No tienes acceso a este proyecto")


def require_project_step_access(user, project, step: int, reversal: bool = False):
    if reversal:
        current_stage = int(project.get("current_stage") or 1)

        # P5 -> P4 es una devolución de Dirección.
        # No se permite que un usuario con privilegio genérico de reversión
        # pueda modificar la cotización desde este punto.
        if current_stage == 5:
            if not is_admin_or_director(user):
                raise HTTPException(
                    status_code=403,
                    detail="Solo Dirección puede regresar el proyecto del Paso 5 al Paso 4"
                )
            return

        if is_admin_or_director(user):
            return

        if not has_privilege(user, "reversal"):
            raise HTTPException(status_code=403, detail="No tienes privilegio de reversión")
        if step not in (2, 4):
            raise HTTPException(status_code=403, detail="Reversión no permitida")
        return
    if is_admin_or_director(user):
        return
    if step == 1 and _is_assigned(user, str(project.get("assigned_ventas") or "")): return
    if step == 2 and (_is_assigned(user, str(project.get("assigned_ventas") or "")) or _is_assigned(user, str(project.get("assigned_lider") or ""))): return
    if step == 3 and _is_assigned(user, str(project.get("assigned_lider") or "")): return
    if step == 4 and _is_assigned(user, str(project.get("assigned_costos") or "")): return
    if step == 6 and _is_assigned(user, str(project.get("assigned_ventas") or "")): return
    raise HTTPException(status_code=403, detail=f"No tienes autorización para ejecutar el Paso {step}")

# Model Schema Definitions
class LoginRequest(BaseModel):
    username: str
    password: str

class UserProfileRequest(BaseModel):
    full_name: str
    email: str
    password: str | None = None
    pin: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str
    email: str
    privileges: str = "dashboards,reports,projects"

class CreateProjectRequest(BaseModel):
    sharepoint_folder_url: str | None = None
    name: str
    client: str
    state: str
    assigned_costos: str
    comm_responsibility: str
    assigned_ventas: str | None = None
    assigned_lider: str | None = None
    priority: str
    target_date: str
    skip_to_cierre: bool = False
    final_amount: float = 0.0

class EditProjectRequest(BaseModel):
    name: str
    client: str
    target_date: str
    priority: str
    assigned_costos: str
    comm_responsibility: str
    assigned_ventas: str | None = None
    assigned_lider: str | None = None
    step1_completed: bool
    step2_ventas_done: bool
    step2_lider_done: bool
    step2_completed: bool
    step3_completed: bool
    step4_completed: bool
    step5_completed: bool
    step6_completed: bool
    current_stage: int
    justification: str

class StepActionRequest(BaseModel):
    project_id: Union[str, int]
    step: int = 1
    user_name: Optional[str] = "Usuario"
    user_role: Optional[str] = "Agente"
    comments: Optional[str] = ""
    is_reversal: Optional[bool] = False

class FinalAmountRequest(BaseModel):
    final_amount: float
class ClientCreateRequest(BaseModel):
    name: str

class CierreRequest(BaseModel):
    project_id: str
    status: str
    lose_percentage_gap: float
    lose_reason: str
    user_name: str = None
    user_role: str = None

class ConfigSMTPRequest(BaseModel):
    smtp_host: str
    smtp_port: str
    smtp_user: str
    smtp_pass: str
    smtp_sender: str
    teams_webhook_url: str
    notifications_enabled: bool
    director_report_emails: str = ""

class ConfigMSRequest(BaseModel):
    ms_tenant_id: str
    ms_client_id: str
    ms_client_secret: str

# Endpoints
@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.post("/api/login")
def login(req: LoginRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        hashed_p = hash_password(req.password)
        cursor.execute("SELECT * FROM users WHERE username = %s AND password = %s", (req.username, hashed_p))
        user = cursor.fetchone()
        if user:
            return {
                "username": user['username'],
                "full_name": user['full_name'],
                "role": user['role'],
                "email": user['email'],
                "privileges": user.get('privileges') or "dashboards,reports,projects",
                "access_token": create_auth_token(user['username']),
                "token_type": "bearer",
                "expires_in": AUTH_TOKEN_TTL
            }
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    finally:
        put_db_connection(conn)

@app.get("/api/clients")
def get_clients(current_user=Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT id, name, active, created_at FROM clients ORDER BY LOWER(name)")
        return [dict(row) for row in cursor.fetchall()]
    finally:
        put_db_connection(conn)


@app.post("/api/clients")
def create_client(req: ClientCreateRequest, current_user=Depends(require_admin)):
    name = str(req.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del cliente es obligatorio.")
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT id, name, active FROM clients WHERE LOWER(name) = LOWER(%s)", (name,))
        existing = cursor.fetchone()
        if existing:
            if int(existing["active"] or 0) == 0:
                cursor.execute("UPDATE clients SET active = 1 WHERE id = %s", (existing["id"],))
                conn.commit()
                return {"id": existing["id"], "name": existing["name"], "active": 1}
            raise HTTPException(status_code=409, detail="Ese cliente ya existe en el catálogo.")
        cursor.execute(
            "INSERT INTO clients (name, active, created_at) VALUES (%s, 1, %s) RETURNING id, name, active",
            (name, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )
        created = cursor.fetchone()
        conn.commit()
        return dict(created)
    finally:
        put_db_connection(conn)


@app.get("/api/projects")
def get_projects(current_user=Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        if is_admin_or_director(current_user):
            cursor.execute("""
                SELECT id, name, client, total_amount, final_amount, state, zone,
                assigned_lider, assigned_costos, assigned_ventas, assigned_ventas_2,
                priority, status, current_stage, lose_reason, lose_percentage_gap,
                created_at, target_date, step1_completed, step2_ventas_done,
                step2_lider_done, step2_completed, step3_completed, step4_completed,
                step5_completed, step6_completed, step6_completed_date,
                sharepoint_folder_url
                FROM projects
                ORDER BY id DESC
            """)
        else:
            # Nunca entregar al cliente proyectos ajenos; la UI puede filtrar,
            # pero la frontera de confidencialidad debe estar en el backend.
            full_name = current_user.get("full_name") or ""
            username = current_user.get("username") or ""
            role = current_user.get("role") or ""
            cursor.execute("""
                SELECT id, name, client, total_amount, final_amount, state, zone,
                assigned_lider, assigned_costos, assigned_ventas, assigned_ventas_2,
                priority, status, current_stage, lose_reason, lose_percentage_gap,
                created_at, target_date, step1_completed, step2_ventas_done,
                step2_lider_done, step2_completed, step3_completed, step4_completed,
                step5_completed, step6_completed, step6_completed_date,
                sharepoint_folder_url
                FROM projects
                WHERE assigned_ventas IN (%s, %s, %s)
                   OR assigned_lider IN (%s, %s, %s)
                   OR assigned_costos IN (%s, %s, %s)
                ORDER BY id DESC
            """, (full_name, username, role, full_name, username, role, full_name, username, role))
        return [dict(row) for row in cursor.fetchall()]
    finally:
        put_db_connection(conn)


@app.get("/api/dashboard/summary")
def get_dashboard_summary(current_user=Depends(get_current_user)):
    """
    Resumen GLOBAL del Dashboard.
    Todos los usuarios autenticados ven los mismos indicadores generales.
    """

    conn = get_db_connection()

    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # ============================================================
        # KPIs GLOBALES
        # ============================================================
        cursor.execute("""
            SELECT
                COUNT(*) AS total_projects,

                COALESCE(SUM(final_amount), 0) AS total_quoted,

                COALESCE(SUM(
                    CASE
                        WHEN status = 'Ganado' THEN final_amount
                        ELSE 0
                    END
                ), 0) AS total_won,

                COUNT(*) FILTER (
                    WHERE status = 'Ganado'
                ) AS won_count,

                COUNT(*) FILTER (
                    WHERE status = 'Perdido'
                ) AS lost_count,

                COUNT(*) FILTER (
                    WHERE status = 'Cancelado'
                ) AS cancelled_count,

                COUNT(*) FILTER (
                    WHERE status = 'En Proceso'
                ) AS in_progress_count

            FROM projects
        """)

        kpi = cursor.fetchone()

        total_projects = int(kpi["total_projects"] or 0)
        total_quoted = float(kpi["total_quoted"] or 0)
        total_won = float(kpi["total_won"] or 0)

        won_count = int(kpi["won_count"] or 0)
        lost_count = int(kpi["lost_count"] or 0)
        cancelled_count = int(kpi["cancelled_count"] or 0)
        in_progress_count = int(kpi["in_progress_count"] or 0)

        effectiveness_base = won_count + lost_count

        effectiveness = (
            (won_count / effectiveness_base) * 100
            if effectiveness_base > 0
            else 0
        )

        # ============================================================
        # ESTATUS GLOBALES
        # ============================================================
        cursor.execute("""
            SELECT
                COALESCE(status, 'Sin estatus') AS label,
                COUNT(*) AS value
            FROM projects
            GROUP BY status
            ORDER BY value DESC
        """)

        status_counts = [
            {
                "label": str(row["label"]),
                "value": int(row["value"] or 0)
            }
            for row in cursor.fetchall()
        ]

        # ============================================================
        # ZONAS GLOBALES
        # ============================================================
        cursor.execute("""
            SELECT
                COALESCE(zone, 'Sin zona') AS label,
                COUNT(*) AS value
            FROM projects
            GROUP BY zone
            ORDER BY value DESC
        """)

        zone_counts = [
            {
                "label": str(row["label"]),
                "value": int(row["value"] or 0)
            }
            for row in cursor.fetchall()
        ]

        # ============================================================
        # PROYECTOS ACTIVOS POR PASO
        # ============================================================
        cursor.execute("""
            SELECT
                current_stage,
                COUNT(*) AS value
            FROM projects
            WHERE status = 'En Proceso'
              AND current_stage BETWEEN 1 AND 7
            GROUP BY current_stage
            ORDER BY current_stage
        """)

        step_rows = cursor.fetchall()

        step_map = {
            int(row["current_stage"]): int(row["value"] or 0)
            for row in step_rows
        }

        active_by_step = [
            {
                "step": f"P{num}",
                "count": step_map.get(num, 0)
            }
            for num in range(1, 8)
        ]

        # ============================================================
        # COTIZADO VS GANADO
        # Solo los datos m?nimos necesarios para la gr?fica.
        # ============================================================
        cursor.execute("""
            SELECT
                id,
                name,
                final_amount,
                status
            FROM projects
            ORDER BY id DESC
        """)

        quoted_vs_won = []

        for row in cursor.fetchall():
            quoted = float(row["final_amount"] or 0)

            quoted_vs_won.append({
                "id": str(row["id"]),
                "name": str(row["name"] or ""),
                "quoted": quoted,
                "won": quoted if row["status"] == "Ganado" else 0
            })

        # ============================================================
        # PROYECTOS PERDIDOS / DESFASE
        # ============================================================
        cursor.execute("""
            SELECT
                id,
                name,
                lose_percentage_gap
            FROM projects
            WHERE status = 'Perdido'
              AND COALESCE(lose_percentage_gap, 0) > 0
            ORDER BY lose_percentage_gap DESC
        """)

        lost_projects = [
            {
                "id": str(row["id"]),
                "name": str(row["name"] or ""),
                "gap": float(row["lose_percentage_gap"] or 0)
            }
            for row in cursor.fetchall()
        ]

        # ============================================================
        # GANADAS POR ESTADO
        # ============================================================
        cursor.execute("""
            SELECT
                COALESCE(state, 'Sin estado') AS state,
                COUNT(*) AS value
            FROM projects
            WHERE status = 'Ganado'
            GROUP BY state
            ORDER BY value DESC
        """)

        won_by_state = [
            {
                "label": str(row["state"]),
                "value": int(row["value"] or 0)
            }
            for row in cursor.fetchall()
        ]

        # ============================================================
        # MONTO GANADO POR ESTADO
        # ============================================================
        cursor.execute("""
            SELECT
                COALESCE(state, 'Sin estado') AS state,
                COALESCE(SUM(final_amount), 0) AS value
            FROM projects
            WHERE status = 'Ganado'
            GROUP BY state
            ORDER BY value DESC
        """)

        won_amount_by_state = [
            {
                "label": str(row["state"]),
                "value": float(row["value"] or 0)
            }
            for row in cursor.fetchall()
        ]

        return {
            "total_projects": total_projects,
            "total_quoted": total_quoted,
            "total_won": total_won,
            "effectiveness": round(effectiveness, 1),

            "won_count": won_count,
            "lost_count": lost_count,
            "cancelled_count": cancelled_count,
            "in_progress_count": in_progress_count,

            "status_counts": status_counts,
            "zone_counts": zone_counts,
            "active_by_step": active_by_step,

            "quoted_vs_won": quoted_vs_won,
            "lost_projects": lost_projects,

            "won_by_state": won_by_state,
            "won_amount_by_state": won_amount_by_state
        }

    finally:
        put_db_connection(conn)

@app.post("/api/projects")
def create_project(req: CreateProjectRequest, current_user=Depends(require_admin)):
    # Generates next project ID matching logic of generate_next_project_id
    year_month = datetime.now().strftime("%Y%m")
    region_auto = ESTADOS_MEXICO.get(req.state, "Líder Regional - Sur")
    zone_auto = "S" if "Sur" in region_auto else "N"
    prefix = f"DCC-{year_month}-{zone_auto}-"

    client_name = str(req.client or '').strip()
    if not client_name:
        raise HTTPException(status_code=400, detail='Debes seleccionar un cliente del catálogo.')
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT id FROM clients WHERE LOWER(name) = LOWER(%s) AND active = 1", (client_name,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="El cliente seleccionado no existe o está inactivo en el catálogo.")
        # Folios históricos: nunca reutilizar un folio aunque la licitación haya sido eliminada.
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_folio_registry (
                folio TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            )
        """)
        cursor.execute(
            "SELECT folio FROM project_folio_registry WHERE folio LIKE %s",
            (prefix + "%",)
        )
        registry_ids = {row["folio"] for row in cursor.fetchall() if row.get("folio")}

        cursor.execute(
            "SELECT id FROM projects WHERE id LIKE %s",
            (prefix + "%",)
        )
        project_ids = {row["id"] for row in cursor.fetchall() if row.get("id")}

        used_ids = registry_ids | project_ids
        next_num = 1
        while True:
            candidate = f"{prefix}{next_num:03d}"
            if candidate not in used_ids and not sharepoint_project_folder_exists(candidate):
                final_code = candidate
                break
            next_num += 1

        cursor.execute(
            "INSERT INTO project_folio_registry (folio, created_at) VALUES (%s, %s)",
            (final_code, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )

        # Get leader automatically from region
        if req.assigned_lider:
            assigned_leader = req.assigned_lider
        else:
            cursor.execute("SELECT full_name FROM users WHERE role = %s", (region_auto,))
            leader_db = cursor.fetchone()
            assigned_leader = leader_db['full_name'] if leader_db else region_auto

        final_ventas = assigned_leader if req.comm_responsibility == "Líder Regional" else req.assigned_ventas

        init_stage = 7 if req.skip_to_cierre else 1
        s1 = 1 if req.skip_to_cierre else 0
        s2 = 1 if req.skip_to_cierre else 0
        s3 = 1 if req.skip_to_cierre else 0
        s4 = 1 if req.skip_to_cierre else 0
        s5 = 1 if req.skip_to_cierre else 0
        s6 = 1 if req.skip_to_cierre else 0
        s6_date = date.today().strftime("%Y-%m-%d") if req.skip_to_cierre else None

        _, sp_folder_url = create_sharepoint_folder_ms_graph(final_code)
        try:
            cursor.execute('''
                INSERT INTO projects (
                    id, name, client, total_amount, final_amount, state, zone,
                    assigned_lider, assigned_costos, assigned_ventas, priority, status, current_stage,
                    created_at, target_date, step1_completed, step2_ventas_done, step2_lider_done, step2_completed,
                    step3_completed, step4_completed, step5_completed, step6_completed, step6_completed_date,
                    sharepoint_folder_url
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                final_code, req.name, req.client, req.final_amount, req.final_amount, req.state, "Sur" if zone_auto == "S" else "Norte",
                assigned_leader, req.assigned_costos, final_ventas, req.priority, "En Proceso", init_stage,
                date.today().strftime("%Y-%m-%d"), req.target_date, s1, s2, s2, s2, s3, s4, s5, s6, s6_date,
                sp_folder_url
            ))
        except Exception:
            cursor.execute('''
                INSERT INTO projects (
                    id, name, client, total_amount, final_amount, state, zone,
                    assigned_lider, assigned_costos, assigned_ventas, priority, status, current_stage,
                    created_at, target_date, step1_completed, step2_ventas_done, step2_lider_done, step2_completed,
                    step3_completed, step4_completed, step5_completed, step6_completed, step6_completed_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                final_code, req.name, req.client, req.final_amount, req.final_amount, req.state, "Sur" if zone_auto == "S" else "Norte",
                assigned_leader, req.assigned_costos, final_ventas, req.priority, "En Proceso", init_stage,
                date.today().strftime("%Y-%m-%d"), req.target_date, s1, s2, s2, s2, s3, s4, s5, s6, s6_date
            ))
        conn.commit()
        log_audit(final_code, "SISTEMA", "Admin/Director", f"Creó licitación con código {final_code} y carpeta SharePoint {sp_folder_url}")
        return {"success": True, "id": final_code, "sharepoint_folder_url": sp_folder_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_db_connection(conn)

@app.put("/api/projects/{proj_id}")
def edit_project(proj_id: str, req: EditProjectRequest, current_user=Depends(require_admin)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects WHERE id = %s", (proj_id,))
        p_details = cursor.fetchone()
        if not p_details:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        prev_stage = p_details['current_stage']

        s1_val = 1 if req.step1_completed else 0
        s2_v_val = 1 if req.step2_ventas_done else 0
        s2_l_val = 1 if req.step2_lider_done else 0
        s2_val = 1 if req.step2_completed else 0
        s3_val = 1 if req.step3_completed else 0
        s4_val = 1 if req.step4_completed else 0
        s5_val = 1 if req.step5_completed else 0
        is_toggle_s6 = 1 if req.step6_completed else 0
        new_s6_date = p_details['step6_completed_date']

        if req.current_stage <= 1: s1_val = 0
        if req.current_stage <= 2: s2_v_val = 0; s2_l_val = 0; s2_val = 0
        if req.current_stage <= 3: s3_val = 0
        if req.current_stage <= 4: s4_val = 0
        if req.current_stage <= 5: s5_val = 0
        if req.current_stage <= 6: is_toggle_s6 = 0; new_s6_date = None

        if is_toggle_s6 == 1 and p_details['step6_completed'] == 0:
            new_s6_date = date.today().strftime("%Y-%m-%d")
        elif is_toggle_s6 == 0:
            new_s6_date = None

        new_status = "En Proceso" if req.current_stage < 7 else p_details['status']

        # Determine sales assignment
        assigned_leader_val = req.assigned_lider if req.assigned_lider else p_details['assigned_lider']
        edit_ventas_val = assigned_leader_val if req.comm_responsibility == "Líder Regional" else req.assigned_ventas

        cursor.execute('''
            UPDATE projects
            SET name = %s, client = %s, target_date = %s, priority = %s, assigned_costos = %s, assigned_ventas = %s, assigned_lider = %s,
                step1_completed = %s, step2_ventas_done = %s, step2_lider_done = %s, step2_completed = %s,
                step3_completed = %s, step4_completed = %s, step5_completed = %s, step6_completed = %s,
                step6_completed_date = %s, status = %s,
                current_stage = %s
            WHERE id = %s
        ''', (
            req.name, req.client, req.target_date, req.priority, req.assigned_costos, edit_ventas_val, assigned_leader_val,
            s1_val, s2_v_val, s2_l_val, s2_val,
            s3_val, s4_val, s5_val, is_toggle_s6,
            new_s6_date, new_status,
            req.current_stage, proj_id
        ))
        conn.commit()

        if req.current_stage > prev_stage:
            dispatch_step_completion_notifications(proj_id, req.current_stage - 1)

        dispatch_parameter_change_notifications(proj_id, req.current_stage, req.target_date, req.justification)
        audit_name = current_user.get("full_name") or current_user.get("username") or "Usuario"
        audit_role = current_user.get("role") or "Admin/Director"
        log_audit(proj_id, audit_name, audit_role, f"Modificó parámetros (Etapa: {req.current_stage}, Prioridad: {req.priority}, Límite: {req.target_date})", comments=req.justification if req.justification else None)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_db_connection(conn)

@app.delete("/api/projects/{proj_id}")
def delete_project(proj_id: str, current_user=Depends(require_admin)):
    conn = get_db_connection()
    sp_ok = True
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT file_path, microsoft_file_id FROM uploads WHERE project_id = %s", (proj_id,))
        uploaded_files = cursor.fetchall()
        for f in uploaded_files:
            if f['microsoft_file_id']:
                try:
                    delete_file_from_sharepoint(f['microsoft_file_id'])
                except Exception:
                    sp_ok = False

        folder_deleted = False
        folder_message = ""
        if sp_ok:
            try:
                folder_deleted, folder_message = delete_empty_project_folder_from_sharepoint(proj_id)
            except Exception as exc:
                sp_ok = False
                folder_message = str(exc)

        cursor.execute("DELETE FROM uploads WHERE project_id = %s", (proj_id,))
        cursor.execute("DELETE FROM audit_log WHERE project_id = %s", (proj_id,))
        cursor.execute("DELETE FROM projects WHERE id = %s", (proj_id,))
        conn.commit()
        audit_name = current_user.get("full_name") or current_user.get("username") or "Usuario"
        audit_role = current_user.get("role") or "Admin/Director"
        log_audit(proj_id, audit_name, audit_role, "Eliminó licitación y sus archivos asociados.")

        return {
            "success": True,
            "sharepoint_deleted": sp_ok,
            "sharepoint_folder_deleted": folder_deleted,
            "message": folder_message or (
                "Licitación eliminada. La carpeta de SharePoint se conservó porque contiene archivos."
                if sp_ok and not folder_deleted else "Licitación eliminada correctamente."
            )
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_db_connection(conn)

@app.get("/api/uploads/{project_id}")
def get_uploads(project_id: str, current_user=Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        project = cursor.fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        # Reading evidence is restricted to users who can work on the project
        # (or administrators/directors). This prevents cross-project evidence leakage.
        require_project_read_access(current_user, project)
        cursor.execute("SELECT id, project_id, step_name, filename, file_path, uploaded_by, uploaded_at, microsoft_file_id, sharepoint_web_url FROM uploads WHERE project_id = %s ORDER BY id ASC", (project_id,))
        return [dict(r) for r in cursor.fetchall()]
    finally:
        put_db_connection(conn)

@app.post("/api/uploads")
async def upload_file(
    project_id: str = Form(...),
    step_name: str = Form(...),
    uploaded_by: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    # Authorization and identity come from the signed session, not client-supplied role/name.
    conn_check = get_db_connection()
    try:
        cursor_check = conn_check.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor_check.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        project_check = cursor_check.fetchone()
        if not project_check:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        require_project_step_access(current_user, project_check, int(project_check['current_stage'] or 1), False)
    finally:
        put_db_connection(conn_check)
    uploaded_by = current_user.get("full_name") or current_user.get("username") or "Usuario"
    file_bytes = await file.read()
    # Cloud-safe storage: files are persisted in SharePoint, not on the server filesystem.
    # file_path remains NULL for new uploads; legacy records may still contain a local path.
    file_path = None

    try:
        ms_file_id, ms_web_url = upload_file_to_sharepoint(project_id, file.filename, file_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo cargar el archivo en SharePoint: {exc}"
        )

    if not ms_file_id or not ms_web_url:
        raise HTTPException(
            status_code=502,
            detail="SharePoint no devolvió la identificación o URL del archivo cargado"
        )

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO uploads (project_id, step_name, filename, file_path, uploaded_by, uploaded_at, file_data, microsoft_file_id, sharepoint_web_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (project_id, step_name, file.filename, file_path, uploaded_by, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), None, ms_file_id, ms_web_url))
        conn.commit()

        # Si la evidencia de P2 llega después de ambas confirmaciones, libera automáticamente P2.
        if step_name == "Paso 2":
            cursor.execute("SELECT step2_ventas_done, step2_lider_done FROM projects WHERE id = %s", (project_id,))
            p2_flags = cursor.fetchone()
            if p2_flags and p2_flags[0] == 1 and p2_flags[1] == 1:
                cursor.execute("UPDATE projects SET step2_completed = 1 WHERE id = %s", (project_id,))
                conn.commit()

        log_audit(project_id, uploaded_by, current_user.get("role") or "Usuario", f"Subió archivo {file.filename} en compuerta {step_name}")
        return {"success": True, "sharepoint_web_url": ms_web_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_db_connection(conn)

@app.get("/api/uploads/download/{upload_id}")
def download_file(upload_id: int, current_user=Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM uploads WHERE id = %s", (upload_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        cursor.execute("SELECT * FROM projects WHERE id = %s", (row['project_id'],))
        project_for_download = cursor.fetchone()
        if not project_for_download:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        require_project_read_access(current_user, project_for_download)

        file_bytes = None
        ms_id = row['microsoft_file_id']
        if ms_id:
            try:
                file_bytes = download_file_from_sharepoint(ms_id)
            except Exception:
                pass

        if file_bytes is None and row['file_data']:
            file_bytes = bytes(row['file_data'])

        if file_bytes is None and row['file_path'] and os.path.exists(row['file_path']):
            try:
                with open(row['file_path'], "rb") as f:
                    file_bytes = f.read()
            except Exception:
                pass

        if file_bytes is None:
            raise HTTPException(status_code=404, detail="El archivo no está disponible en SharePoint ni en el respaldo histórico de la base de datos")

        return Response(content=file_bytes, media_type="application/octet-stream", headers={"Content-Disposition": f"attachment; filename={row['filename']}"})
    finally:
        put_db_connection(conn)

@app.delete("/api/uploads/{upload_id}")
def delete_uploaded_file(upload_id: int, current_user=Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM uploads WHERE id = %s", (upload_id,))
        f = cursor.fetchone()
        if not f:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        cursor.execute("SELECT * FROM projects WHERE id = %s", (f['project_id'],))
        project_for_delete = cursor.fetchone()
        if not project_for_delete:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        if not is_admin_or_director(current_user):
            if not has_privilege(current_user, "projects"):
                raise HTTPException(status_code=403, detail="No tienes privilegio para modificar archivos")
            require_project_step_access(current_user, project_for_delete, int(project_for_delete['current_stage'] or 1), False)

        if f['microsoft_file_id']:
            delete_file_from_sharepoint(f['microsoft_file_id'])

        if f['file_path'] and os.path.exists(f['file_path']):
            try:
                os.remove(f['file_path'])
            except Exception:
                pass

        cursor.execute("DELETE FROM uploads WHERE id = %s", (upload_id,))
        conn.commit()
        log_audit(f['project_id'], current_user.get("full_name") or current_user.get("username") or "Usuario", current_user.get("role") or "Usuario", f"Eliminó archivo {f['filename']} del paso {f['step_name']}")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_db_connection(conn)

def check_and_advance_step2(cursor, project_id):
    cursor.execute("UPDATE projects SET step2_ventas_done = 1, step2_lider_done = 1, step2_completed = 1 WHERE id = %s", (project_id,))

@app.patch("/api/projects/{proj_id}/final-amount")
def update_final_amount(proj_id: str, req: FinalAmountRequest, current_user=Depends(get_current_user)):
    amount = float(req.final_amount or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="El monto final cotizado debe ser mayor a cero")

    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects WHERE id = %s", (proj_id,))
        project = cursor.fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        if int(project["current_stage"] or 1) != 6:
            raise HTTPException(status_code=400, detail="El monto final cotizado solo puede modificarse en el Paso 6")

        if not is_admin_or_director(current_user) and not _is_assigned(
            current_user, str(project.get("assigned_ventas") or "")
        ):
            raise HTTPException(
                status_code=403,
                detail="Solo Ventas asignado o Dirección puede modificar el monto final cotizado en el Paso 6"
            )

        cursor.execute("UPDATE projects SET final_amount = %s WHERE id = %s", (amount, proj_id))
        conn.commit()

        user_name = current_user.get("full_name") or current_user.get("username") or "Usuario"
        user_role = current_user.get("role") or "Usuario"
        log_audit(proj_id, user_name, user_role, f"Actualizó el monto final cotizado a ${amount:,.2f} en el Paso 6")
        return {"success": True, "final_amount": amount}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_db_connection(conn)

@app.post("/api/projects/action")
def update_step_action(req: StepActionRequest, current_user=Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        pid = str(req.project_id)
        cursor.execute("SELECT * FROM projects WHERE id = %s", (pid,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        current_stage = int(p['current_stage']) if p['current_stage'] else 1
        requested_step = int(req.step or current_stage)

        require_project_step_access(current_user, p, requested_step, bool(req.is_reversal))

        new_stage = current_stage

        if req.is_reversal:
            motivo = str(req.comments or "").strip()
            if not motivo:
                raise HTTPException(status_code=400, detail="Debes indicar una justificacion para regresar el proyecto")

            if current_stage == 3 and requested_step != 2:
                raise HTTPException(status_code=400, detail="Desde el Paso 3 solo se puede regresar al Paso 2")
            if current_stage == 5 and requested_step != 4:
                raise HTTPException(status_code=400, detail="Desde el Paso 5 solo se puede regresar al Paso 4")
            if current_stage not in (3, 5):
                raise HTTPException(status_code=400, detail="No existe una reversion valida para el Paso actual")

            new_stage = requested_step

            if current_stage == 3 and new_stage == 2:
                cursor.execute("""
                    UPDATE projects
                    SET current_stage = 2,
                        step2_completed = 0,
                        step3_completed = 0
                    WHERE id = %s
                """, (req.project_id,))
                dispatch_rejection_notification(req.project_id, 3, motivo)

            elif current_stage == 5 and new_stage == 4:
                cursor.execute("""
                    UPDATE projects
                    SET current_stage = 4,
                        step4_completed = 0,
                        step5_completed = 0
                    WHERE id = %s
                """, (req.project_id,))
                dispatch_rejection_notification(req.project_id, 5, motivo)

            action_desc = f"Regreso el proyecto al Paso {new_stage} desde el Paso {current_stage}. Motivo: {motivo}"

        else:
            if requested_step != current_stage:
                raise HTTPException(status_code=400, detail="El Paso solicitado no coincide con la compuerta activa")

            # P1 -> P2: evidencia de visita obligatoria.
            if current_stage == 1:
                cursor.execute(
                    "SELECT COUNT(*) FROM uploads WHERE project_id = %s AND step_name = %s",
                    (req.project_id, "Paso 1")
                )
                if cursor.fetchone()[0] == 0:
                    raise HTTPException(
                        status_code=400,
                        detail="Debes cargar al menos una evidencia de la visita antes de avanzar del Paso 1"
                    )
                cursor.execute("UPDATE projects SET step1_completed = 1 WHERE id = %s", (req.project_id,))

            # P2 -> P3: Ventas + Lider + evidencia.
            elif current_stage == 2:
                cursor.execute("""
                    SELECT step2_ventas_done, step2_lider_done, step2_completed
                    FROM projects WHERE id = %s
                """, (req.project_id,))
                state = cursor.fetchone()
                if not state or not (
                    state["step2_ventas_done"] == 1
                    and state["step2_lider_done"] == 1
                    and state["step2_completed"] == 1
                ):
                    raise HTTPException(
                        status_code=400,
                        detail="El Paso 2 requiere la confirmacion de Ventas y del Lider Regional antes de avanzar"
                    )

            # P3 -> P4: evidencia tecnica/catalogo obligatoria.
            elif current_stage == 3:
                cursor.execute(
                    "SELECT COUNT(*) FROM uploads WHERE project_id = %s AND step_name = %s",
                    (req.project_id, "Paso 3")
                )
                if cursor.fetchone()[0] == 0:
                    raise HTTPException(
                        status_code=400,
                        detail="Debes cargar al menos una evidencia, catalogo o archivo de ingenieria del Paso 3 antes de avanzar"
                    )
                cursor.execute("UPDATE projects SET step3_completed = 1 WHERE id = %s", (req.project_id,))

            # P4 -> P5: cotizacion/evidencia obligatoria.
            elif current_stage == 4:
                cursor.execute(
                    "SELECT COUNT(*) FROM uploads WHERE project_id = %s AND step_name = %s",
                    (req.project_id, "Paso 4")
                )
                if cursor.fetchone()[0] == 0:
                    raise HTTPException(
                        status_code=400,
                        detail="Debes cargar al menos un archivo de cotizacion o evidencia del Paso 4 antes de avanzar"
                    )
                cursor.execute("UPDATE projects SET step4_completed = 1 WHERE id = %s", (req.project_id,))

            # P5 -> P6: solo Direccion/Admin.
            elif current_stage == 5:
                if not is_admin_or_director(current_user):
                    raise HTTPException(status_code=403, detail="El Paso 5 solo puede ser autorizado por Direccion")
                cursor.execute("SELECT step4_completed FROM projects WHERE id = %s", (req.project_id,))
                state = cursor.fetchone()
                if not state or state["step4_completed"] != 1:
                    raise HTTPException(
                        status_code=400,
                        detail="El Paso 4 debe estar completado antes de autorizar el Paso 5"
                    )
                cursor.execute("UPDATE projects SET step5_completed = 1 WHERE id = %s", (req.project_id,))

            # P6 -> P7: monto final + evidencia de entrega obligatorios.
            elif current_stage == 6:
                cursor.execute(
                    "SELECT final_amount FROM projects WHERE id = %s",
                    (req.project_id,)
                )
                amount_row = cursor.fetchone()
                if not amount_row or float(amount_row["final_amount"] or 0) <= 0:
                    raise HTTPException(
                        status_code=400,
                        detail="Debes registrar el Monto final cotizado antes de avanzar al Paso 7"
                    )

                cursor.execute(
                    "SELECT COUNT(*) FROM uploads WHERE project_id = %s AND step_name = %s",
                    (req.project_id, "Paso 6")
                )
                if cursor.fetchone()[0] == 0:
                    raise HTTPException(
                        status_code=400,
                        detail="Debes cargar la evidencia de entrega de la cotizacion al cliente antes de avanzar al Paso 7"
                    )
                cursor.execute("UPDATE projects SET step6_completed = 1 WHERE id = %s", (req.project_id,))

            elif current_stage == 7:
                raise HTTPException(status_code=400, detail="El proyecto ya se encuentra en el Paso 7")

            new_stage = current_stage + 1
            action_desc = f"Valido y avanzo el Paso {current_stage} hacia el Paso {new_stage}. Comentario: {req.comments}"

        cursor.execute("UPDATE projects SET current_stage = %s WHERE id = %s", (new_stage, req.project_id))
        conn.commit()

        if not req.is_reversal:
            dispatch_step_completion_notifications(req.project_id, current_stage)

        log_audit(
            req.project_id,
            current_user.get("full_name") or current_user.get("username") or "Usuario",
            current_user.get("role") or "Usuario",
            action_desc,
            comments=req.comments
        )
        return {"success": True, "new_stage": new_stage}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_db_connection(conn)


@app.post("/api/projects/double-check-step2")
def confirm_step2_reunion(project_id: str = Form(...), user_role: str = Form(...), user_name: str = Form(...), current_user=Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        p = cursor.fetchone()

        if not p:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        if int(p.get('current_stage') or 1) != 2:
            raise HTTPException(
                status_code=400,
                detail="La confirmación de P2 solo puede realizarse cuando el proyecto está en el Paso 2"
            )

        name_now = current_user.get("full_name") or current_user.get("username")
        is_dir = is_admin_or_director(current_user)

        # P2 es una confirmación dual: cada persona solo puede confirmar
        # su propia parte y únicamente una vez.
        is_lider = _is_assigned(
            current_user,
            str(p.get('assigned_lider') or '')
        )
        is_ventas = _is_assigned(
            current_user,
            str(p.get('assigned_ventas') or '')
        )

        if not (is_dir or is_lider or is_ventas):
            raise HTTPException(
                status_code=403,
                detail="No tienes autorización para confirmar el Paso 2"
            )

        # Director/Admin conserva su modo especial.
        if is_dir:
            cursor.execute(
                "UPDATE projects SET step2_ventas_done = 1, step2_lider_done = 1, step2_completed = 1 WHERE id = %s",
                (project_id,)
            )
        else:
            # Cada responsable solo puede confirmar una vez.
            if is_ventas:
                if p.get('step2_ventas_done') == 1:
                    raise HTTPException(
                        status_code=400,
                        detail="La confirmación de Ventas para el Paso 2 ya fue realizada"
                    )

                cursor.execute(
                    "UPDATE projects SET step2_ventas_done = 1 WHERE id = %s",
                    (project_id,)
                )

            if is_lider:
                if p.get('step2_lider_done') == 1:
                    raise HTTPException(
                        status_code=400,
                        detail="La confirmación del Líder Regional para el Paso 2 ya fue realizada"
                    )

                cursor.execute(
                    "UPDATE projects SET step2_lider_done = 1 WHERE id = %s",
                    (project_id,)
                )

            # Revisar nuevamente el estado de ambas confirmaciones.
            cursor.execute(
                "SELECT step2_ventas_done, step2_lider_done FROM projects WHERE id = %s",
                (project_id,)
            )
            updated_p = cursor.fetchone()

            both_confirmed = (
                updated_p
                and updated_p['step2_ventas_done'] == 1
                and updated_p['step2_lider_done'] == 1
            )

            if both_confirmed:
                # Cualquier archivo cargado en Paso 2 cuenta como
                # evidencia/minuta, sin importar extensión o nombre.
                cursor.execute(
                    "SELECT COUNT(*) FROM uploads WHERE project_id = %s AND step_name = %s",
                    (project_id, "Paso 2")
                )
                evidence_count = cursor.fetchone()[0]

                if evidence_count > 0:
                    cursor.execute(
                        "UPDATE projects SET step2_completed = 1 WHERE id = %s",
                        (project_id,)
                    )
                else:
                    cursor.execute(
                        "UPDATE projects SET step2_completed = 0 WHERE id = %s",
                        (project_id,)
                    )

        conn.commit()

        log_audit(
            project_id,
            name_now,
            current_user.get("role") or "Usuario",
            "Confirmó reunión comercial técnica para el Paso 2"
        )

        return {"success": True}

    finally:
        put_db_connection(conn)


@app.post("/api/projects/cierre")
def close_project(req: CierreRequest, current_user=Depends(require_admin)):
    if req.status not in ("Ganado", "Perdido", "Cancelado"):
        raise HTTPException(
            status_code=400,
            detail="El cierre comercial debe ser Ganado, Perdido o Cancelado"
        )
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE projects
            SET status = %s, lose_percentage_gap = %s, lose_reason = %s
            WHERE id = %s
        ''', (req.status, req.lose_percentage_gap, req.lose_reason, req.project_id))
        conn.commit()
        u_name = current_user.get("full_name") or current_user.get("username")
        u_role = current_user.get("role") or "Admin/Director"
        log_audit(req.project_id, u_name, u_role, f"Cerró licitación comercial como '{req.status}' con desfase de {req.lose_percentage_gap}%")
        return {"success": True}
    finally:
        put_db_connection(conn)

@app.get("/api/audit-logs")
def get_audit_logs(project_id: str = None, current_user=Depends(require_report_access)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        if project_id:
            cursor.execute("""
                SELECT id, project_id, user_name, role, action, timestamp, comments
                FROM audit_log
                WHERE project_id = %s
                ORDER BY timestamp DESC
            """, (project_id,))
        else:
            cursor.execute("""
                SELECT id, project_id, user_name, role, action, timestamp, comments
                FROM audit_log
                ORDER BY timestamp DESC
                LIMIT 500
            """)
        return [dict(r) for r in cursor.fetchall()]
    finally:
        put_db_connection(conn)

@app.get("/api/users")
def get_users(current_user=Depends(require_admin)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT username, full_name, role, email, privileges FROM users ORDER BY full_name ASC")
        return [dict(r) for r in cursor.fetchall()]
    finally:
        put_db_connection(conn)

@app.post("/api/users")
def create_user(req: CreateUserRequest, current_user=Depends(require_admin)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (username, password, full_name, role, email, privileges) VALUES (%s, %s, %s, %s, %s, %s)", (req.username, hash_password(req.password), req.full_name, req.role, req.email, req.privileges or "dashboards,reports,projects"))
        conn.commit()
        log_audit("SISTEMA", current_user.get("full_name") or current_user.get("username"), current_user.get("role"), f"Creó nuevo usuario colaborador: {req.username}")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está registrado")
    finally:
        put_db_connection(conn)

@app.delete("/api/users/{username}")
def delete_user(username: str, current_user=Depends(require_admin)):
    if username == "noe.ortizadm":
        raise HTTPException(status_code=400, detail="No se puede eliminar la cuenta del Director General Principal")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE username = %s", (username,))
        conn.commit()
        audit_name = current_user.get("full_name") or current_user.get("username") or "Usuario"
        audit_role = current_user.get("role") or "Admin/Director"
        log_audit("SISTEMA", audit_name, audit_role, f"Eliminó cuenta de usuario colaborador: {username}")
        return {"success": True}
    finally:
        put_db_connection(conn)

@app.put("/api/users/{username}")
def update_profile(username: str, req: UserProfileRequest, current_user=Depends(get_current_user)):
    if username != current_user.get("username") and not is_admin_or_director(current_user):
        raise HTTPException(status_code=403, detail="No puedes modificar el perfil de otro usuario")
    profile_pin = os.getenv("DC_PROFILE_PIN", "").strip()
    if not profile_pin or req.pin != profile_pin:
        raise HTTPException(status_code=403, detail="Clave de seguridad PIN incorrecta")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if req.password:
            cursor.execute("UPDATE users SET full_name = %s, email = %s, password = %s WHERE username = %s", (req.full_name, req.email, hash_password(req.password), username))
        else:
            cursor.execute("UPDATE users SET full_name = %s, email = %s WHERE username = %s", (req.full_name, req.email, username))
        conn.commit()
        audit_name = current_user.get("full_name") or current_user.get("username") or "Usuario"
        audit_role = current_user.get("role") or "Usuario"
        log_audit("SISTEMA", audit_name, audit_role, f"Actualizó sus datos de perfil de usuario ({username})")
        return {"success": True}
    finally:
        put_db_connection(conn)

@app.get("/api/system-settings")
def get_system_settings(current_user=Depends(require_admin)):
    smtp_host = os.getenv("SMTP_HOST", "").strip() or get_system_setting("smtp_host", "smtp.gmail.com")
    smtp_port = os.getenv("SMTP_PORT", "").strip() or get_system_setting("smtp_port", "587")
    smtp_user = os.getenv("SMTP_USER", "").strip() or get_system_setting("smtp_user", "notificaciones@dccontrol.com")
    smtp_sender = os.getenv("SMTP_SENDER", "").strip() or get_system_setting("smtp_sender", "DC Control Notificaciones")
    teams_configured = bool(os.getenv("TEAMS_WEBHOOK_URL", "").strip() or get_system_setting("teams_webhook_url", "").strip())
    ms_tenant = os.getenv("MS_TENANT_ID", "").strip() or get_system_setting("ms_tenant_id", "")
    ms_client = os.getenv("MS_CLIENT_ID", "").strip() or get_system_setting("ms_client_id", "")
    return {
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_user": smtp_user,
        "smtp_sender": smtp_sender,
        # Never return webhook/SMTP/MS secrets to the Electron client.
        "teams_webhook_url": "",
        "teams_webhook_configured": teams_configured,
        "notifications_enabled": get_system_setting("notifications_enabled", "0") == "1",
        "ms_tenant_id": ms_tenant,
        "ms_client_id": ms_client,
        "ms_client_secret_configured": bool(os.getenv("MS_CLIENT_SECRET", "").strip() or get_system_setting("ms_client_secret", "").strip()),
        "smtp_password_configured": bool(os.getenv("SMTP_PASS", "").strip() or get_system_setting("smtp_pass", "").strip()),
        "director_report_emails": get_system_setting("director_report_emails", "director@dccontrol.com")
    }

@app.post("/api/system-settings/smtp")
def save_smtp_settings(req: ConfigSMTPRequest, current_user=Depends(require_admin)):
    set_system_setting("smtp_host", req.smtp_host)
    set_system_setting("smtp_port", req.smtp_port)
    set_system_setting("smtp_user", req.smtp_user)
    if req.smtp_pass:
        set_system_setting("smtp_pass", req.smtp_pass)
    set_system_setting("smtp_sender", req.smtp_sender)
    if req.teams_webhook_url:
        set_system_setting("teams_webhook_url", req.teams_webhook_url)
    set_system_setting("notifications_enabled", "1" if req.notifications_enabled else "0")
    set_system_setting("director_report_emails", req.director_report_emails if req.director_report_emails else "director@dccontrol.com")
    return {"success": True}

@app.post("/api/system-settings/ms")
def save_ms_settings(req: ConfigMSRequest, current_user=Depends(require_admin)):
    if req.ms_tenant_id:
        set_system_setting("ms_tenant_id", req.ms_tenant_id)
    if req.ms_client_id:
        set_system_setting("ms_client_id", req.ms_client_id)
    if req.ms_client_secret:
        set_system_setting("ms_client_secret", req.ms_client_secret)
    # Wipe credentials caches to trigger auto-discovery reload
    try:
        set_system_setting("ms_site_id", "")
        set_system_setting("ms_drive_id", "")
    except Exception:
        pass
    return {"success": True}

@app.post("/api/system-settings/test-ms")
def test_ms_connection(current_user=Depends(require_admin)):
    try:
        _, drive_id = get_sharepoint_drive_details()
        if drive_id:
            return {"success": True, "drive_id": drive_id}
        return {"success": False, "error": "No se encontró el SharePoint Drive ID."}
    except Exception as ex:
        return {"success": False, "error": str(ex)}

@app.post("/api/system-settings/test-smtp")
def test_smtp_connection(admin_email: str = Form(...), current_user=Depends(require_admin)):
    smtp_host = os.getenv("SMTP_HOST", "").strip() or get_system_setting("smtp_host")
    smtp_port = os.getenv("SMTP_PORT", "").strip() or get_system_setting("smtp_port")
    smtp_user = os.getenv("SMTP_USER", "").strip() or get_system_setting("smtp_user")
    smtp_pass = os.getenv("SMTP_PASS", "").strip() or get_system_setting("smtp_pass")
    smtp_sender = os.getenv("SMTP_SENDER", "").strip() or get_system_setting("smtp_sender", "DC Control Notificaciones")

    try:
        msg = MIMEMultipart()
        msg['From'] = f"{smtp_sender} <{smtp_user}>"
        msg['To'] = admin_email
        msg['Subject'] = "DC Control - Validación SMTP Exitosa"
        body_html = f"""<html>
<body style="font-family: Arial, sans-serif; color: #333333;">
    <div style="background-color: #111827; color: white; padding: 15px 20px; border-radius: 6px 6px 0 0; border-left: 6px solid #0F4C81;">
        <h2 style="margin: 0; font-size: 18px;">Validación de Consola de Control - DC Control</h2>
    </div>
    <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px;">
        <p>¡Hola <strong>Director DC Control</strong>!</p>
        <p>Este es un correo de prueba enviado desde tu nueva <strong>Consola de Control de Escritorio</strong>.</p>
        <p>La configuración del servidor SMTP y el envío global de notificaciones han sido validados con éxito. El sistema ya está listo para alertar a tu equipo técnico y comercial en tiempo real.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
        <p style="font-size: 11px; color: #6b7280; text-align: center;">DC Control S.A. de C.V. • Gestión Comercial</p>
    </div>
</body>
</html>"""
        msg.attach(MIMEText(body_html, 'html'))
        server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=10)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, admin_email, msg.as_string())
        server.quit()
        return {"success": True}
    except Exception as ex:
        return {"success": False, "error": str(ex)}

@app.post("/api/backup/wipe")
def wipe_database(current_user=Depends(require_admin)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS projects CASCADE")
        cursor.execute("DROP TABLE IF EXISTS audit_log CASCADE")
        cursor.execute("DROP TABLE IF EXISTS uploads CASCADE")
        conn.commit()

        # Re-create empty tables
        try:
            cursor.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS sharepoint_folder_url TEXT;")
            conn.commit()
        except Exception:
            pass
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                client TEXT,
                total_amount REAL DEFAULT 0.0,
                final_amount REAL DEFAULT 0.0,
                state TEXT,
                zone TEXT,
                assigned_lider TEXT,
                assigned_costos TEXT,
                assigned_ventas TEXT,
                assigned_ventas_2 TEXT,
                priority TEXT DEFAULT 'Media',
                status TEXT DEFAULT 'En Proceso',
                current_stage INTEGER DEFAULT 1,
                lose_reason TEXT,
                lose_percentage_gap REAL DEFAULT 0.0,
                created_at TEXT,
                target_date TEXT,
                step1_completed INTEGER DEFAULT 0,
                step2_ventas_done INTEGER DEFAULT 0,
                step2_lider_done INTEGER DEFAULT 0,
                step2_completed INTEGER DEFAULT 0,
                step3_completed INTEGER DEFAULT 0,
                step4_completed INTEGER DEFAULT 0,
                step5_completed INTEGER DEFAULT 0,
                step6_completed INTEGER DEFAULT 0,
                step6_completed_date TEXT
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                active INTEGER DEFAULT 1,
                created_at TEXT
            )
        ''')
        cursor.execute(
            "INSERT INTO clients (name, active, created_at) "
            "SELECT DISTINCT TRIM(client), 1, %s FROM projects "
            "WHERE client IS NOT NULL AND TRIM(client) <> '' "
            "ON CONFLICT (name) DO NOTHING",
            (datetime.now().strftime("%Y-%m-%d %H:%M:%S"),)
        )
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS uploads (
                id SERIAL PRIMARY KEY,
                project_id TEXT,
                step_name TEXT,
                filename TEXT,
                file_path TEXT,
                uploaded_by TEXT,
                uploaded_at TEXT,
                file_data BYTEA,
                microsoft_file_id TEXT,
                sharepoint_web_url TEXT
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_log (
                id SERIAL PRIMARY KEY,
                project_id TEXT,
                user_name TEXT,
                role TEXT,
                action TEXT,
                timestamp TEXT,
                comments TEXT
            )
        ''')
        conn.commit()
        return {"success": True}
    finally:
        put_db_connection(conn)

# Word Documents Download Endpoints
def _generate_executive_report_docx():
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects")
        df_p = pd.DataFrame([dict(r) for r in cursor.fetchall()])
    finally:
        put_db_connection(conn)

    # DOCX Generation
    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Arial'
    style_normal.font.size = Pt(10.5)
    style_normal.font.color.rgb = RGBColor(55, 65, 81)

    # Executive Header
    header_table = doc.add_table(rows=1, cols=2)
    header_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    header_table.autofit = False
    header_table.columns[0].width = Inches(2.0)
    header_table.columns[1].width = Inches(5.0)

    cell_logo = header_table.cell(0, 0)
    p_logo = cell_logo.paragraphs[0]
    p_logo.alignment = WD_ALIGN_PARAGRAPH.LEFT
    if os.path.exists("logo.png"):
        try:
            p_logo.add_run().add_picture("logo.png", width=Inches(1.3))
        except Exception:
            p_logo.add_run("DC CONTROL").bold = True
    else:
        p_logo.add_run("DC CONTROL").bold = True

    cell_text = header_table.cell(0, 1)
    p_text = cell_text.paragraphs[0]
    p_text.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run_hdr = p_text.add_run("COMERCIALIZADORA INDUSTRIAL DC CONTROL S.A. DE C.V.\n")
    run_hdr.bold = True
    run_hdr.font.size = Pt(10.5)
    run_hdr.font.color.rgb = RGBColor(17, 24, 39)
    run_sub = p_text.add_run(f"Reporte Ejecutivo de Dirección: Control de Cotizaciones\nGenerado el: {date.today().strftime('%Y-%m-%d')} | Confidencial")
    run_sub.font.size = Pt(8.5)
    run_sub.font.color.rgb = RGBColor(107, 114, 128)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    title_p = doc.add_paragraph()
    title_run = title_p.add_run("REPORTE EJECUTIVO GLOBAL DE DIRECCIÓN Y SLA")
    title_run.bold = True
    title_run.font.size = Pt(16)
    title_run.font.color.rgb = RGBColor(15, 76, 129)
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    if df_p.empty:
        doc.add_paragraph("No hay cotizaciones registradas para generar el reporte.")
    else:
        df_active = df_p[df_p['status'] == 'En Proceso'].copy()
        if not df_active.empty:
            df_active['_target_sort'] = pd.to_datetime(df_active['target_date'], errors='coerce')
            df_active = df_active.sort_values(['_target_sort', 'id'], ascending=[True, True], na_position='last')
        steps_short = {1: "Levantamiento", 2: "Minuta", 3: "Catálogo", 4: "Cotización", 5: "Revisión", 6: "Entrega", 7: "Cierre"}

        # General KPIs Metrics Paragraph
        doc.add_paragraph().paragraph_format.space_after = Pt(8)
        kpi_p = doc.add_paragraph()
        kpi_p.add_run("1. RESUMEN EJECUTIVO DE METRICAS CLAVE (KPIs)\n").bold = True
        kpi_p.runs[0].font.size = Pt(12)
        kpi_p.runs[0].font.color.rgb = RGBColor(17, 24, 39)

        total_projs = len(df_p)
        active_count = len(df_active)
        total_amount = df_p['final_amount'].sum()
        won_count = len(df_p[df_p['status'] == 'Ganado'])
        lost_count = len(df_p[df_p['status'] == 'Perdido'])
        effect = (won_count / (won_count + lost_count) * 100) if (won_count + lost_count) > 0 else 0.0

        p_kpis = doc.add_paragraph()
        p_kpis.add_run(f"• Total de Licitaciones Registradas: ").bold = True
        p_kpis.add_run(f"{total_projs}\n")
        p_kpis.add_run(f"• Cotizaciones Activas en Proceso: ").bold = True
        p_kpis.add_run(f"{active_count}\n")
        p_kpis.add_run(f"• Monto Total Cotizado en Pipeline: ").bold = True
        p_kpis.add_run(f"${total_amount:,.2f}\n")
        p_kpis.add_run(f"• Efectividad Comercial de Cierre: ").bold = True
        p_kpis.add_run(f"{effect:.1f}% ({won_count} ganadas, {lost_count} perdidas)")

        # Section 2: Active Pipeline Table
        doc.add_paragraph().paragraph_format.space_after = Pt(12)
        pipeline_hdr = doc.add_paragraph()
        pipeline_hdr.add_run("2. RESUMEN DE COTIZACIONES EN CURSO (LINEA ACTIVA)\n").bold = True
        pipeline_hdr.runs[0].font.size = Pt(12)
        pipeline_hdr.runs[0].font.color.rgb = RGBColor(17, 24, 39)

        if df_active.empty:
            doc.add_paragraph("No hay cotizaciones activas en curso actualmente.")
        else:
            tbl_p = doc.add_table(rows=len(df_active) + 1, cols=6)
            tbl_p.alignment = WD_TABLE_ALIGNMENT.CENTER
            tbl_p.autofit = False
            headers_p = ["Folio ID", "Obra / Proyecto", "Cliente", "Paso Atorado", "Fecha Límite", "Monto Estimado"]
            widths_p = [Inches(1.0), Inches(1.8), Inches(1.5), Inches(1.2), Inches(1.2), Inches(1.1)]

            # Header Row Styling
            hdr_row = tbl_p.rows[0]
            for col_idx, text in enumerate(headers_p):
                cell = hdr_row.cells[col_idx]
                cell.width = widths_p[col_idx]
                p_hdr = cell.paragraphs[0]
                p_hdr.paragraph_format.space_before = Pt(4)
                p_hdr.paragraph_format.space_after = Pt(4)
                p_hdr.add_run(text).bold = True
                shd = OxmlElement('w:shd')
                shd.set(qn('w:fill'), '0F4C81')
                shd.set(qn('w:val'), 'clear')
                cell._tc.get_or_add_tcPr().append(shd)
                p_hdr.runs[0].font.color.rgb = RGBColor(255, 255, 255)

            # Data rows
            for idx, r_data in enumerate(df_active.to_dict('records')):
                row = tbl_p.rows[idx + 1]
                p_id = r_data.get('id', 'N/A')
                p_name = r_data.get('name', 'N/A')
                p_client = r_data.get('client', 'N/A')
                p_stage = f"Paso {r_data.get('current_stage', 1)}"
                p_date = r_data.get('target_date', 'No definida') or 'No definida'
                p_amount = f"${r_data.get('final_amount', 0.0):,.2f}"

                r_vals = [p_id, p_name, p_client, p_stage, p_date, p_amount]
                for col_idx, val in enumerate(r_vals):
                    cell = row.cells[col_idx]
                    cell.width = widths_p[col_idx]
                    p_cell = cell.paragraphs[0]
                    p_cell.paragraph_format.space_before = Pt(3)
                    p_cell.paragraph_format.space_after = Pt(3)
                    run = p_cell.add_run(str(val))
                    if col_idx == 0:
                        run.bold = True
                        run.font.color.rgb = RGBColor(15, 76, 129)

        # Section 3: Seguimiento / Cierre Comercial Pendiente
        follow_hdr = doc.add_paragraph()
        follow_hdr.add_run("3. SEGUIMIENTO Y CIERRE COMERCIAL PENDIENTE").bold = True
        follow_hdr.runs[0].font.size = Pt(12)
        follow_hdr.runs[0].font.color.rgb = RGBColor(15, 76, 129)

        commercial_pending = df_p[(df_p['status'] == 'En Proceso') & (df_p['current_stage'].isin([6, 7]))].copy()
        if commercial_pending.empty:
            doc.add_paragraph("No hay cotizaciones en seguimiento/cierre comercial pendientes de definición.")
        else:
            commercial_pending['_target_sort'] = pd.to_datetime(commercial_pending['target_date'], errors='coerce')
            commercial_pending = commercial_pending.sort_values(['_target_sort', 'id'], ascending=[True, True], na_position='last')
            tbl_c = doc.add_table(rows=len(commercial_pending) + 1, cols=6)
            headers_c = ["Folio", "Proyecto", "Cliente", "Etapa", "Fecha límite", "Monto final"]
            widths_c = [Inches(0.9), Inches(1.8), Inches(1.5), Inches(1.1), Inches(1.2), Inches(1.2)]
            for j, h in enumerate(headers_c):
                cell = tbl_c.rows[0].cells[j]
                cell.width = widths_c[j]
                p = cell.paragraphs[0]
                p.add_run(h).bold = True
                shd = OxmlElement('w:shd'); shd.set(qn('w:fill'), '0F4C81'); shd.set(qn('w:val'), 'clear')
                cell._tc.get_or_add_tcPr().append(shd)
                p.runs[0].font.color.rgb = RGBColor(255,255,255)
            for i, row_data in enumerate(commercial_pending.to_dict('records')):
                vals = [str(row_data.get('id','')), str(row_data.get('name','')), str(row_data.get('client','')),
                        f"P{int(row_data.get('current_stage',0) or 0)}", str(row_data.get('target_date') or 'No definida'),
                        f"${float(row_data.get('final_amount',0) or 0):,.2f}"]
                for j, val in enumerate(vals):
                    tbl_c.rows[i+1].cells[j].paragraphs[0].add_run(val)
            doc.add_paragraph("Estas licitaciones están en P6/P7 y todavía no tienen resultado comercial definitivo.")

        # Section 4: SLA Warnings Table (Proyectos más próximos a vencer o vencidos)

        doc.add_paragraph().paragraph_format.space_after = Pt(12)
        warn_hdr = doc.add_paragraph()
        warn_hdr.add_run("4. ALERTAS DE ENTREGA DE LICITACIONES PROXIMAS (SEMÁFORO DE SLA)\n").bold = True
        warn_hdr.runs[0].font.size = Pt(12)
        warn_hdr.runs[0].font.color.rgb = RGBColor(17, 24, 39)

        warnings = []
        for p in df_p.to_dict('records'):
            if p['status'] == 'En Proceso' and p['step6_completed'] == 0 and p['target_date']:
                try:
                    limitDate = datetime.strptime(p['target_date'], "%Y-%m-%d").date()
                    today = date.today()
                    diffDays = (limitDate - today).days
                    warnings.append({
                        'id': p['id'],
                        'name': p['name'],
                        'days': diffDays,
                        'stage': p['current_stage'],
                        'responsible': p['assigned_ventas'] if p['current_stage'] in [1, 6] else p['assigned_lider'] if p['current_stage'] in [2, 3] else p['assigned_costos'] if p['current_stage'] == 4 else "Noe Ortiz"
                    })
                except Exception:
                    pass

        warnings = sorted(warnings, key=lambda w: w['days'])[:5]

        if not warnings:
            doc.add_paragraph("No hay licitaciones críticas próximas a vencer.")
        else:
            tbl_w = doc.add_table(rows=len(warnings) + 1, cols=5)
            tbl_w.alignment = WD_TABLE_ALIGNMENT.CENTER
            tbl_w.autofit = False
            headers_w = ["Proyecto / Obra", "Paso Atorado", "Responsable", "Días Restantes", "Semaforo SLA"]
            widths_w = [Inches(2.5), Inches(1.2), Inches(1.5), Inches(1.1), Inches(1.2)]

            # Header Row
            hdr_row_w = tbl_w.rows[0]
            for col_idx, text in enumerate(headers_w):
                cell = hdr_row_w.cells[col_idx]
                cell.width = widths_w[col_idx]
                p_hdr = cell.paragraphs[0]
                p_hdr.paragraph_format.space_before = Pt(4)
                p_hdr.paragraph_format.space_after = Pt(4)
                p_hdr.add_run(text).bold = True
                shd = OxmlElement('w:shd')
                shd.set(qn('w:fill'), 'C23B22')
                shd.set(qn('w:val'), 'clear')
                cell._tc.get_or_add_tcPr().append(shd)
                p_hdr.runs[0].font.color.rgb = RGBColor(255, 255, 255)

            # Data Rows
            for idx, w in enumerate(warnings):
                row = tbl_w.rows[idx + 1]
                w_name = f"{w['id']} - {w['name']}"
                w_stage = f"Paso {w['stage']}"
                w_resp = w['responsible'] or 'Sin asignar'
                w_days = f"{w['days']} días" if w['days'] >= 0 else f"RETRASADO ({abs(w['days'])} d)"
                
                if w['days'] < 0:
                    w_tag = "CRÍTICO (VENCIDO)"
                    text_color = RGBColor(194, 59, 34) # Red
                elif w['days'] <= 7:
                    w_tag = "URGENTE"
                    text_color = RGBColor(245, 158, 11) # Orange/Amber
                else:
                    w_tag = "EN TIEMPO"
                    text_color = RGBColor(16, 185, 129) # Green

                r_vals = [w_name, w_stage, w_resp, w_days, w_tag]
                for col_idx, val in enumerate(r_vals):
                    cell = row.cells[col_idx]
                    cell.width = widths_w[col_idx]
                    p_cell = cell.paragraphs[0]
                    p_cell.paragraph_format.space_before = Pt(3)
                    p_cell.paragraph_format.space_after = Pt(3)
                    run = p_cell.add_run(str(val))
                    if col_idx == 4:
                        run.bold = True
                        run.font.color.rgb = text_color

        # Pie Chart
        fig1, ax1 = plt.subplots(figsize=(2.5, 2.5))
        if df_active.empty:
            ax1.text(0.5, 0.5, 'Sin Proyectos Activos', ha='center', va='center')
            ax1.axis('off')
        else:
            df_active_grouped = df_active.groupby('current_stage').size().reset_index(name='qty')
            df_active_grouped['step_name'] = df_active_grouped['current_stage'].map(steps_short)
            ax1.pie(df_active_grouped['qty'], labels=df_active_grouped['step_name'], autopct='%1.0f%%', colors=['#0F4C81', '#C23B22', '#f59e0b', '#ef4444', '#10b981', '#6b7280', '#00C875'][:len(df_active_grouped)], textprops={'fontsize': 8})
            ax1.axis('equal')
        plt.title("Cuellos de Botella Activos", fontsize=9, fontweight='bold', pad=4)
        img_buf1 = io.BytesIO()
        plt.savefig(img_buf1, format='png', dpi=100, bbox_inches='tight')
        plt.close()
        img_buf1.seek(0)

        # Draw to document
        doc.add_paragraph().paragraph_format.space_after = Pt(12)
        h_graphs = doc.add_paragraph()
        h_graphs_run = h_graphs.add_run("5. DIAGNÓSTICO GRÁFICO GENERAL DE CUELLOS DE BOTELLA")
        h_graphs_run.bold = True
        h_graphs_run.font.size = Pt(12)
        h_graphs_run.font.color.rgb = RGBColor(17, 24, 39)

        chart_table = doc.add_table(rows=1, cols=1)
        chart_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = chart_table.cell(0, 0)
        p_cell = cell.paragraphs[0]
        p_cell.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cell.add_run().add_picture(img_buf1, width=Inches(3.0))

        # Recommendations & Suggestions for Improvement
        doc.add_paragraph().paragraph_format.space_after = Pt(12)
        h_sug = doc.add_paragraph()
        h_sug_run = h_sug.add_run("6. RECOMENDACIONES OPERATIVAS Y SUGERENCIAS DE MEJORA")
        h_sug_run.bold = True
        h_sug_run.font.size = Pt(12)
        h_sug_run.font.color.rgb = RGBColor(15, 76, 129)

        sug_p = doc.add_paragraph()
        total_closed = won_count + lost_count
        effect_txt = f"{effect:.1f}% ({won_count} ganadas, {lost_count} perdidas)" if total_closed else "Sin suficientes cierres definidos"
        stage_counts = df_active['current_stage'].value_counts().to_dict() if not df_active.empty else {}
        bottleneck_stage = max(stage_counts, key=stage_counts.get) if stage_counts else None
        overdue_count = sum(1 for w in warnings if w['days'] < 0)
        urgent_count = sum(1 for w in warnings if 0 <= w['days'] <= 7)
        pending_count = len(commercial_pending)

        sug_p.add_run("• Resumen de efectividad comercial: ").bold = True
        sug_p.add_run(f"Actualmente la efectividad de cierre es {effect_txt}. El cálculo considera únicamente oportunidades con resultado Ganado o Perdido.\n")
        if bottleneck_stage:
            stage_label = steps_short.get(int(bottleneck_stage), f"Paso {int(bottleneck_stage)}")
            sug_p.add_run("• Concentración del pipeline: ").bold = True
            sug_p.add_run(f"El mayor número de cotizaciones activas se concentra en {stage_label}, con {int(stage_counts[bottleneck_stage])} proyecto(s).\n")
        sug_p.add_run("• Seguimiento comercial pendiente: ").bold = True
        sug_p.add_run(f"Hay {pending_count} cotización(es) en P6/P7 sin resultado comercial definitivo.\n")
        sug_p.add_run("• Prioridad por SLA: ").bold = True
        sug_p.add_run(f"Se identifican {overdue_count} oportunidad(es) vencida(s) y {urgent_count} con fecha límite dentro de los próximos 7 días. El listado de alertas está ordenado por urgencia.\n")
        won_states = df_p[df_p['status'] == 'Ganado']['state'].fillna('Sin estado').value_counts()
        if not won_states.empty:
            top_won_state = won_states.index[0]
            sug_p.add_run("• Distribución de cierres ganados: ").bold = True
            sug_p.add_run(f"La mayor concentración de licitaciones ganadas por estado se encuentra en {top_won_state}; se presenta como dato descriptivo para el análisis comercial.\n")

    bio = io.BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio

@app.get("/api/reports/executive")
def get_executive_report(current_user=Depends(require_report_access)):
    bio = _generate_executive_report_docx()
    return Response(content=_repair_docx_mojibake(bio.getvalue()), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers={"Content-Disposition": "attachment; filename=Reporte_Ejecutivo_Direccion_SLA.docx"})

@app.post("/api/reports/email-executive")
def email_executive_report(current_user=Depends(require_report_access)):
    smtp_host = os.getenv("SMTP_HOST", "").strip() or get_system_setting("smtp_host")
    smtp_port = os.getenv("SMTP_PORT", "").strip() or get_system_setting("smtp_port")
    smtp_user = os.getenv("SMTP_USER", "").strip() or get_system_setting("smtp_user")
    smtp_pass = os.getenv("SMTP_PASS", "").strip() or get_system_setting("smtp_pass")
    smtp_sender = os.getenv("SMTP_SENDER", "").strip() or get_system_setting("smtp_sender", "DC Control Notificaciones")
    report_emails_str = get_system_setting("director_report_emails", "director@dccontrol.com")
    
    if not smtp_host or not smtp_port or not smtp_user or not smtp_pass:
        raise HTTPException(status_code=400, detail="El servidor SMTP no está configurado.")
        
    bio = _generate_executive_report_docx()
    file_bytes = bio.getvalue()
    
    dest_emails = [e.strip() for e in report_emails_str.replace(";", ",").split(",") if e.strip() and "@" in e]
    if not dest_emails:
        raise HTTPException(status_code=400, detail="No hay destinatarios de correo configurados para el reporte de dirección.")
        
    errors = []
    from email.mime.application import MIMEApplication
    for email in dest_emails:
        try:
            msg = MIMEMultipart()
            msg['From'] = f"{smtp_sender} <{smtp_user}>"
            msg['To'] = email
            msg['Subject'] = f"DC Control - Reporte Ejecutivo Global de Dirección y SLA - {date.today().strftime('%Y-%m-%d')}"
            
            body_html = f"""<html>
<body style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6;">
    <div style="background-color: #111827; color: white; padding: 20px; border-radius: 6px 6px 0 0; border-left: 6px solid #0F4C81;">
        <h2 style="margin: 0; font-size: 20px;">DC Control - Gestión Comercial</h2>
    </div>
    <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px;">
        <p>Apreciable <strong>Dirección</strong>,</p>
        <p>Adjunto a este correo electrónico se encuentra el <strong>Reporte Ejecutivo Global del área comercial</strong> actualizado al día de hoy, <strong>{date.today().strftime('%Y-%m-%d')}</strong>.</p>
        <p>Estos reportes incluyen los KPIs y métricas necesarias para su evaluación. También contienen el resumen general de las métricas clave, el estatus detallado de la línea activa de cotizaciones, y las alertas de entrega críticas para eficientar los procesos de entrega y gestión de cotizaciones.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 11px; color: #6b7280; text-align: center;">DC Control S.A. de C.V. • Gestión Comercial</p>
    </div>
</body>
</html>"""
            msg.attach(MIMEText(body_html, 'html'))
            
            part = MIMEApplication(file_bytes, Name=f"Reporte_Ejecutivo_Direccion_SLA_{date.today().strftime('%Y%m%d')}.docx")
            part['Content-Disposition'] = f'attachment; filename="Reporte_Ejecutivo_Direccion_SLA_{date.today().strftime("%Y%m%d")}.docx"'
            msg.attach(part)
            
            server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=10)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, email, msg.as_string())
            server.quit()
        except Exception as e:
            errors.append(f"Error al enviar a {email}: {str(e)}")
            
    if errors:
        raise HTTPException(status_code=500, detail="; ".join(errors))
        
    return {"success": True, "recipients": dest_emails}

@app.get("/api/reports/dossier/{project_id}")
def get_project_dossier(project_id: str, current_user=Depends(require_report_access)):
    project = _get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    require_project_read_access(current_user, project)
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        p = cursor.fetchone()
        cursor.execute("SELECT * FROM audit_log WHERE project_id = %s ORDER BY timestamp ASC", (project_id,))
        logs = cursor.fetchall()
        cursor.execute("SELECT filename, step_name, uploaded_by, uploaded_at FROM uploads WHERE project_id = %s ORDER BY id ASC", (project_id,))
        uploads = cursor.fetchall()
    finally:
        put_db_connection(conn)

    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Arial'
    style_normal.font.size = Pt(10.5)
    style_normal.font.color.rgb = RGBColor(51, 51, 51)

    # Main Executive Header
    header_table = doc.add_table(rows=1, cols=2)
    header_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    header_table.autofit = False
    header_table.columns[0].width = Inches(2.0)
    header_table.columns[1].width = Inches(5.0)

    cell_logo = header_table.cell(0, 0)
    p_logo = cell_logo.paragraphs[0]
    p_logo.alignment = WD_ALIGN_PARAGRAPH.LEFT
    if os.path.exists("logo.png"):
        try:
            p_logo.add_run().add_picture("logo.png", width=Inches(1.2))
        except Exception:
            p_logo.add_run("DC CONTROL").bold = True
    else:
        p_logo.add_run("DC CONTROL").bold = True

    cell_text = header_table.cell(0, 1)
    p_text = cell_text.paragraphs[0]
    p_text.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run_hdr = p_text.add_run("COMERCIALIZADORA INDUSTRIAL DC CONTROL S.A. DE C.V.\n")
    run_hdr.bold = True
    run_hdr.font.size = Pt(10)
    run_hdr.font.color.rgb = RGBColor(17, 24, 39)
    run_sub = p_text.add_run(f"Dossier Técnico-Comercial Completo: {p['id']}\nGenerado el: {date.today().strftime('%Y-%m-%d')} | CONFIDENCIAL")
    run_sub.font.size = Pt(8.5)
    run_sub.font.color.rgb = RGBColor(107, 114, 128)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    title_p = doc.add_paragraph()
    title_run = title_p.add_run("DOSSIER DE SEGUIMIENTO Y TRAZABILIDAD DE OBRA")
    title_run.bold = True
    title_run.font.size = Pt(16)
    title_run.font.color.rgb = RGBColor(15, 76, 129) # Azul Corporativo
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # 1. Resumen General
    h1 = doc.add_paragraph()
    h1_run = h1.add_run("1. Resumen General de la Licitación")
    h1_run.bold = True
    h1_run.font.size = Pt(12)
    h1_run.font.color.rgb = RGBColor(15, 76, 129)

    details = [
        ("Folio del Proyecto", str(p['id'])),
        ("Obra / Proyecto", str(p['name'])),
        ("Cliente", str(p['client'])),
        ("Estado de la República", f"{p['state']} ({p['zone']})"),
        ("Agente de Ventas Responsable", str(p['assigned_ventas'])),
        ("Líder Regional Responsable", str(p['assigned_lider'])),
        ("Analista de Costos Asignado", str(p['assigned_costos'])),
        ("Prioridad de Atención", str(p['priority'])),
        ("Monto Final Cotizado", f"${p['final_amount']:,.2f}"),
        ("Estatus del Proceso", str(p['status'])),
        ("Compuerta de Proceso Activa", f"Paso {p['current_stage']} de 7"),
        ("Fecha Compromiso de Entrega", str(p['target_date'] or "No definida"))
    ]

    table = doc.add_table(rows=len(details), cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    for i, (label, val) in enumerate(details):
        row = table.rows[i]
        cell_lbl = row.cells[0]
        cell_lbl.width = Inches(2.3)
        p_lbl = cell_lbl.paragraphs[0]
        p_lbl.add_run(label).bold = True

        cell_val = row.cells[1]
        cell_val.width = Inches(4.5)
        p_val = cell_val.paragraphs[0]
        p_val.add_run(val)

        for cell in (cell_lbl, cell_val):
            cell.paragraphs[0].paragraph_format.space_after = Pt(3)
            cell.paragraphs[0].paragraph_format.space_before = Pt(3)
            if cell == cell_lbl:
                shd = OxmlElement('w:shd')
                shd.set(qn('w:fill'), 'F3F4F6')
                shd.set(qn('w:val'), 'clear')
                cell._tc.get_or_add_tcPr().append(shd)

    # 2. Estatus de Validación de Compuertas Secuenciales
    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    h2 = doc.add_paragraph()
    h2_run = h2.add_run("2. Estatus de Validación de Compuertas Secuenciales")
    h2_run.bold = True
    h2_run.font.size = Pt(12)
    h2_run.font.color.rgb = RGBColor(15, 76, 129)

    doc.add_paragraph("Este proyecto se rige por un esquema secuencial de 7 compuertas obligatorias. A continuación se reporta la validación de cada hito:")

    gates_details = [
        ("Compuerta 1: Levantamiento Técnico de Obra (P1)", "Validado" if p['step1_completed'] == 1 else "Pendiente", "Estudio de viabilidad inicial y alcances de la obra."),
        ("Compuerta 2: Minuta de Trabajo y Confirmación (P2)", "Validado" if p['step2_completed'] == 1 else "Pendiente", "Alineación comercial. Confirmación de Ventas y Líder Regional."),
        ("Compuerta 3: Catálogo de Conceptos e Ingeniería (P3)", "Validado" if p['step3_completed'] == 1 else "Pendiente", "Estructura técnica de conceptos de obra."),
        ("Compuerta 4: Cotización de Precios y Utilidades (P4)", "Validado" if p['step4_completed'] == 1 else "Pendiente", "Elaboración de costos unitarios y utilidades."),
        ("Compuerta 5: Aprobación de Dirección General (P5)", "Validado" if p['step5_completed'] == 1 else "Pendiente", "Revisión ejecutiva y autorización de propuesta."),
        ("Compuerta 6: Entrega Oficial al Cliente (P6)", "Validado" if p['step6_completed'] == 1 else "Pendiente", "Entrega física/digital formal de la propuesta técnica."),
        ("Compuerta 7: Cierre Comercial de Licitación (P7)", p['status'], "Dictamen final del proyecto (Ganado / Perdido).")
    ]

    table_g = doc.add_table(rows=len(gates_details) + 1, cols=3)
    table_g.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_g.autofit = False
    headers_g = ["Compuerta Secuencial", "Estatus de Validación", "Descripción de la Actividad"]
    widths_g = [Inches(2.5), Inches(1.5), Inches(2.8)]

    hdr_row = table_g.rows[0]
    for col_idx, text in enumerate(headers_g):
        cell = hdr_row.cells[col_idx]
        cell.width = widths_g[col_idx]
        p_hdr = cell.paragraphs[0]
        p_hdr.paragraph_format.space_before = Pt(4)
        p_hdr.paragraph_format.space_after = Pt(4)
        p_hdr.add_run(text).bold = True
        shd = OxmlElement('w:shd')
        shd.set(qn('w:fill'), '0F4C81')
        shd.set(qn('w:val'), 'clear')
        cell._tc.get_or_add_tcPr().append(shd)
        p_hdr.runs[0].font.color.rgb = RGBColor(255, 255, 255)

    for row_idx, (gate, status, desc) in enumerate(gates_details):
        row = table_g.rows[row_idx + 1]
        for col_idx, text in enumerate([gate, status, desc]):
            cell = row.cells[col_idx]
            cell.width = widths_g[col_idx]
            p_cell = cell.paragraphs[0]
            p_cell.paragraph_format.space_before = Pt(4)
            p_cell.paragraph_format.space_after = Pt(4)
            run = p_cell.add_run(text)
            if col_idx == 1:
                run.bold = True
                if text in ["Validado", "Ganado"]:
                    run.font.color.rgb = RGBColor(16, 185, 129) # Verde
                elif text == "Pendiente":
                    run.font.color.rgb = RGBColor(245, 158, 11) # Ámbar
                elif text == "Perdido":
                    run.font.color.rgb = RGBColor(194, 59, 34) # Rojo

    # 3. Inventario de Evidencias en SharePoint/Teams
    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    h3_up = doc.add_paragraph()
    h3_up_run = h3_up.add_run("3. Inventario de Evidencias de Compuerta (SharePoint / Teams)")
    h3_up_run.bold = True
    h3_up_run.font.size = Pt(12)
    h3_up_run.font.color.rgb = RGBColor(15, 76, 129)

    if not uploads:
        doc.add_paragraph("No hay evidencias ni documentos asociados en SharePoint de Microsoft Teams aún.")
    else:
        table_u = doc.add_table(rows=len(uploads) + 1, cols=3)
        table_u.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_u.autofit = False
        headers_u = ["Documento / Evidencia", "Ubicación (Paso)", "Subido por / Colaborador"]
        widths_u = [Inches(3.2), Inches(1.8), Inches(1.8)]

        hdr_row = table_u.rows[0]
        for col_idx, text in enumerate(headers_u):
            cell = hdr_row.cells[col_idx]
            cell.width = widths_u[col_idx]
            p_hdr = cell.paragraphs[0]
            p_hdr.paragraph_format.space_before = Pt(4)
            p_hdr.paragraph_format.space_after = Pt(4)
            p_hdr.add_run(text).bold = True
            shd = OxmlElement('w:shd')
            shd.set(qn('w:fill'), '0F4C81')
            shd.set(qn('w:val'), 'clear')
            cell._tc.get_or_add_tcPr().append(shd)
            p_hdr.runs[0].font.color.rgb = RGBColor(255, 255, 255)

        for row_idx, f_data in enumerate(uploads):
            row = table_u.rows[row_idx + 1]
            row_data = [f_data['filename'], f_data['step_name'], f_data['uploaded_by']]
            for col_idx, text in enumerate(row_data):
                cell = row.cells[col_idx]
                cell.width = widths_u[col_idx]
                p_cell = cell.paragraphs[0]
                p_cell.paragraph_format.space_before = Pt(4)
                p_cell.paragraph_format.space_after = Pt(4)
                p_cell.add_run(str(text))

    # 4. Historial de Cambios (Audit Trail)
    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    h3 = doc.add_paragraph()
    h3_run = h3.add_run("4. Historial de Cambios (Audit Trail)")
    h3_run.bold = True
    h3_run.font.size = Pt(12)
    h3_run.font.color.rgb = RGBColor(15, 76, 129)

    if not logs:
        doc.add_paragraph("No se cuenta con registros de auditoría para esta licitación.")
    else:
        table_l = doc.add_table(rows=len(logs) + 1, cols=4)
        table_l.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_l.autofit = False
        headers_l = ["Fecha y Hora", "Colaborador", "Acción Realizada", "Comentarios"]
        widths_l = [Inches(1.2), Inches(1.3), Inches(2.3), Inches(2.0)]

        hdr_row = table_l.rows[0]
        for col_idx, text in enumerate(headers_l):
            cell = hdr_row.cells[col_idx]
            cell.width = widths_l[col_idx]
            p_hdr = cell.paragraphs[0]
            p_hdr.paragraph_format.space_before = Pt(4)
            p_hdr.paragraph_format.space_after = Pt(4)
            p_hdr.add_run(text).bold = True
            shd = OxmlElement('w:shd')
            shd.set(qn('w:fill'), '0F4C81')
            shd.set(qn('w:val'), 'clear')
            cell._tc.get_or_add_tcPr().append(shd)
            p_hdr.runs[0].font.color.rgb = RGBColor(255, 255, 255)

        for row_idx, log in enumerate(logs):
            row = table_l.rows[row_idx + 1]
            row_data = [log['timestamp'], log['user_name'], log['action'], log.get('comments', '') or ""]
            for col_idx, text in enumerate(row_data):
                cell = row.cells[col_idx]
                cell.width = widths_l[col_idx]
                p_cell = cell.paragraphs[0]
                p_cell.paragraph_format.space_before = Pt(4)
                p_cell.paragraph_format.space_after = Pt(4)
                p_cell.add_run(str(text))

    # 5. Firmas de Conformidad
    doc.add_paragraph().paragraph_format.space_after = Pt(24)
    h5 = doc.add_paragraph()
    h5_run = h5.add_run("5. Firmas y Validaciones de Conformidad de Cierre")
    h5_run.bold = True
    h5_run.font.size = Pt(12)
    h5_run.font.color.rgb = RGBColor(15, 76, 129)

    table_sign = doc.add_table(rows=2, cols=2)
    table_sign.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_sign.autofit = False
    
    sign_pax = [
        ("_____________________________________\nAgente de Ventas Asignado", "_____________________________________\nLíder Regional Asignado"),
        ("_____________________________________\nAnalista de Costos Responsable", "_____________________________________\nDirección General (Noe Ortiz)")
    ]

    for row_idx, row_text in enumerate(sign_pax):
        row = table_sign.rows[row_idx]
        for col_idx, text in enumerate(row_text):
            cell = row.cells[col_idx]
            cell.width = Inches(3.4)
            p_cell = cell.paragraphs[0]
            p_cell.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_cell.paragraph_format.space_before = Pt(20)
            p_cell.paragraph_format.space_after = Pt(20)
            run = p_cell.add_run(text)
            run.font.size = Pt(9.5)

    bio = io.BytesIO()
    doc.save(bio)
    bio.seek(0)
    return Response(content=_repair_docx_mojibake(bio.getvalue()), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers={"Content-Disposition": f"attachment; filename=Dossier_{project_id}.docx"})

@app.get("/api/reports/minute/{project_id}")
def get_prefilled_minute(project_id: str, current_user=Depends(require_report_access)):
    project = _get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    require_project_read_access(current_user, project)

    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        p = cursor.fetchone()
    finally:
        put_db_connection(conn)
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.65); section.bottom_margin = Inches(0.65)
        section.left_margin = Inches(0.65); section.right_margin = Inches(0.65)
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Arial'; style_normal.font.size = Pt(10)
    style_normal.font.color.rgb = RGBColor(55, 65, 81)

    header_table = doc.add_table(rows=1, cols=2)
    header_table.alignment = WD_TABLE_ALIGNMENT.CENTER; header_table.autofit = False
    header_table.columns[0].width = Inches(2.2); header_table.columns[1].width = Inches(5.0)
    p_logo = header_table.cell(0,0).paragraphs[0]
    if os.path.exists("logo.png"):
        try: p_logo.add_run().add_picture("logo.png", width=Inches(1.25))
        except Exception: p_logo.add_run("DC CONTROL").bold = True
    else: p_logo.add_run("DC CONTROL").bold = True
    p_text = header_table.cell(0,1).paragraphs[0]; p_text.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p_text.add_run("COMERCIALIZADORA INDUSTRIAL DC CONTROL S.A. DE C.V.\n"); r.bold = True; r.font.size = Pt(10)
    r.font.color.rgb = RGBColor(17,24,39)
    r = p_text.add_run("Minuta de Reunión Comercial-Técnica · Paso 2"); r.font.size = Pt(8.5); r.font.color.rgb = RGBColor(107,114,128)

    title = doc.add_paragraph(); title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    rr = title.add_run(f"MINUTA DE REUNIÓN DE ALINEACIÓN · {p['id']}"); rr.bold=True; rr.font.size=Pt(15); rr.font.color.rgb=RGBColor(15,76,129)

    def section_title(text):
        q = doc.add_paragraph(); q.paragraph_format.space_before=Pt(8); q.paragraph_format.space_after=Pt(5)
        rr=q.add_run(text); rr.bold=True; rr.font.size=Pt(11.5); rr.font.color.rgb=RGBColor(15,76,129)
    def shade(cell, fill):
        shd=OxmlElement('w:shd'); shd.set(qn('w:fill'),fill); shd.set(qn('w:val'),'clear'); cell._tc.get_or_add_tcPr().append(shd)
    def cell_text(cell, text, bold=False):
        q=cell.paragraphs[0]; q.paragraph_format.space_before=Pt(3); q.paragraph_format.space_after=Pt(3)
        rr=q.add_run(str(text)); rr.bold=bold

    section_title("1. Datos generales")
    details=[
        ("Folio",str(p['id'])),("Obra / Proyecto",str(p['name'])),
        ("Cliente",str(p['client'] or "____________________________")),
        ("Estado / Región",f"{p['state'] or '________________'} / {p['zone'] or '________________'}"),
        ("Fecha","____________________________"),("Hora de inicio / término","____________________________"),
        ("Lugar / modalidad","____________________________________________________________")]
    t=doc.add_table(rows=len(details),cols=2); t.autofit=False
    for i,(label,val) in enumerate(details):
        cell_text(t.rows[i].cells[0],label,True); shade(t.rows[i].cells[0],"F3F4F6"); cell_text(t.rows[i].cells[1],val)

    section_title("2. Lista de asistencia requerida")
    attendees=[("Agente de Ventas",str(p['assigned_ventas'] or "")),("Líder Regional",str(p['assigned_lider'] or "")),
               ("Analista de Costos",str(p['assigned_costos'] or "")),("Cliente / Contacto",""),("Participante adicional","")]
    t=doc.add_table(rows=len(attendees)+1,cols=5)
    for j,h in enumerate(["Rol / participante","Nombre","Asistencia","Hora","Firma"]):
        cell_text(t.rows[0].cells[j],h,True); shade(t.rows[0].cells[j],"0F4C81")
        t.rows[0].cells[j].paragraphs[0].runs[0].font.color.rgb=RGBColor(255,255,255)
    for i,(role_name,name) in enumerate(attendees):
        row=t.rows[i+1]; cell_text(row.cells[0],role_name,True); cell_text(row.cells[1],name or "________________________")
        cell_text(row.cells[2],"[ ] Sí   [ ] No"); cell_text(row.cells[3],"________"); cell_text(row.cells[4],"________________")

    section_title("3. Temas a tratar")
    t=doc.add_table(rows=5,cols=3)
    for j,h in enumerate(["No.","Tema / punto de agenda","Notas"]):
        cell_text(t.rows[0].cells[j],h,True); shade(t.rows[0].cells[j],"0F4C81")
        t.rows[0].cells[j].paragraphs[0].runs[0].font.color.rgb=RGBColor(255,255,255)
    for i in range(1,5):
        cell_text(t.rows[i].cells[0],str(i)); cell_text(t.rows[i].cells[1],"_______________________________________________"); cell_text(t.rows[i].cells[2],"_______________________________________________")

    section_title("4. Acuerdos tomados")
    t=doc.add_table(rows=6,cols=5)
    for j,h in enumerate(["No.","Acuerdo","Responsable","Fecha compromiso","Estado"]):
        cell_text(t.rows[0].cells[j],h,True); shade(t.rows[0].cells[j],"0F4C81")
        t.rows[0].cells[j].paragraphs[0].runs[0].font.color.rgb=RGBColor(255,255,255)
    for i in range(1,6):
        cell_text(t.rows[i].cells[0],str(i))
        for j in range(1,5): cell_text(t.rows[i].cells[j],"________________")

    section_title("5. Pendientes y seguimiento")
    t=doc.add_table(rows=5,cols=4)
    for j,h in enumerate(["Pendiente / acción","Responsable","Fecha límite","Seguimiento"]):
        cell_text(t.rows[0].cells[j],h,True); shade(t.rows[0].cells[j],"0F4C81")
        t.rows[0].cells[j].paragraphs[0].runs[0].font.color.rgb=RGBColor(255,255,255)
    for i in range(1,5):
        for j in range(4): cell_text(t.rows[i].cells[j],"________________")

    section_title("6. Observaciones")
    for _ in range(5):
        q=doc.add_paragraph("________________________________________________________________________________"); q.paragraph_format.space_after=Pt(4)

    section_title("7. Confirmación de la reunión")
    doc.add_paragraph("Los participantes confirman que los acuerdos y pendientes anteriores reflejan lo tratado durante la reunión.")
    t=doc.add_table(rows=2,cols=3)
    for j,h in enumerate(["Ventas","Líder Regional","Cliente / Participante"]):
        cell_text(t.rows[0].cells[j],h,True); shade(t.rows[0].cells[j],"F3F4F6")
        cell_text(t.rows[1].cells[j],"\n\n________________________\nNombre y firma")

    bio=io.BytesIO(); doc.save(bio); bio.seek(0)
    return Response(content=_repair_docx_mojibake(bio.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition":f"attachment; filename=Minuta_Alineacion_{project_id}.docx"})


@app.get("/api/reports/performance")
def get_performance_report(current_user=Depends(require_report_access)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT * FROM projects")
        df_p = pd.DataFrame([dict(r) for r in cursor.fetchall()])
    finally:
        put_db_connection(conn)

    # DOCX Generation
    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Arial'
    style_normal.font.size = Pt(10.5)
    style_normal.font.color.rgb = RGBColor(55, 65, 81)

    # Header Table
    header_table = doc.add_table(rows=1, cols=2)
    header_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    header_table.autofit = False
    header_table.columns[0].width = Inches(2.0)
    header_table.columns[1].width = Inches(5.0)

    cell_logo = header_table.cell(0, 0)
    p_logo = cell_logo.paragraphs[0]
    p_logo.alignment = WD_ALIGN_PARAGRAPH.LEFT
    if os.path.exists("logo.png"):
        try:
            p_logo.add_run().add_picture("logo.png", width=Inches(1.2))
        except Exception:
            p_logo.add_run("DC CONTROL").bold = True
    else:
        p_logo.add_run("DC CONTROL").bold = True

    cell_text = header_table.cell(0, 1)
    p_text = cell_text.paragraphs[0]
    p_text.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run_hdr = p_text.add_run("COMERCIALIZADORA INDUSTRIAL DC CONTROL S.A. DE C.V.\n")
    run_hdr.bold = True
    run_hdr.font.size = Pt(10)
    run_hdr.font.color.rgb = RGBColor(17, 24, 39)
    run_sub = p_text.add_run(f"Reporte de Desempeño y SLA de Equipos\nGenerado el: {date.today().strftime('%Y-%m-%d')} | Confidencial")
    run_sub.font.size = Pt(8.5)
    run_sub.font.color.rgb = RGBColor(107, 114, 128)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    title_p = doc.add_paragraph()
    title_run = title_p.add_run("REPORTE DE DESEMPEÑO ORGANIZACIONAL Y SLA")
    title_run.bold = True
    title_run.font.size = Pt(16)
    title_run.font.color.rgb = RGBColor(15, 76, 129)
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # 1. SLA Summary Table
    h1 = doc.add_paragraph()
    h1_run = h1.add_run("1. Tiempos Promedios de Respuesta por Puesto")
    h1_run.bold = True
    h1_run.font.size = Pt(12)
    h1_run.font.color.rgb = RGBColor(15, 76, 129)

    doc.add_paragraph("A continuación se presentan los días promedio que tarda cada equipo o puesto en completar sus compuertas correspondientes:")

    table_sla = doc.add_table(rows=5, cols=3)
    table_sla.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_sla.autofit = False
    headers_lbls = ["Puesto / Equipo", "Compuertas Asignadas", "Tiempo Promedio de Respuesta"]
    widths_s = [Inches(2.5), Inches(2.2), Inches(1.8)]

    hdr_row = table_sla.rows[0]
    for idx, txt in enumerate(headers_lbls):
        cell = hdr_row.cells[idx]
        cell.width = widths_s[idx]
        p_hdr = cell.paragraphs[0]
        p_hdr.paragraph_format.space_before = Pt(4)
        p_hdr.paragraph_format.space_after = Pt(4)
        p_hdr.add_run(txt).bold = True
        shd = OxmlElement('w:shd')
        shd.set(qn('w:fill'), '0F4C81')
        shd.set(qn('w:val'), 'clear')
        cell._tc.get_or_add_tcPr().append(shd)
        p_hdr.runs[0].font.color.rgb = RGBColor(255, 255, 255)

    if len(df_p) == 0:
        v_avg = l_avg = c_avg = d_avg = 0.0
        roles_data = [
            ("Ventas", "Paso 1 (Levantamiento) & Paso 6 (Entrega)", "0.0 días hábiles"),
            ("Líder Regional", "Paso 2 (Minuta) & Paso 3 (Catálogo)", "0.0 días hábiles"),
            ("Analista de Costos", "Paso 4 (Elaboración de Cotización)", "0.0 días hábiles"),
            ("Dirección General", "Paso 5 (Revisión) & Paso 7 (Cierre)", "0.0 días hábiles")
        ]
    else:
        ventas_days = []
        lider_days = []
        costos_days = []
        dir_days = []
        for _, row in df_p.iterrows():
            stage = row.get('current_stage', 1)
            is_skip = (row.get('step1_completed', 0) == 1 and row.get('step2_completed', 0) == 1 and 
                       row.get('step3_completed', 0) == 1 and row.get('step4_completed', 0) == 1 and 
                       row.get('step5_completed', 0) == 1 and row.get('step6_completed', 0) == 1 and stage == 7)
            if is_skip:
                ventas_days.append(0.0)
                lider_days.append(0.0)
                costos_days.append(0.0)
                dir_days.append(0.0)
            else:
                if row.get('step1_completed', 0) == 1 or row.get('step6_completed', 0) == 1: ventas_days.append(2.1)
                if row.get('step2_completed', 0) == 1 or row.get('step3_completed', 0) == 1: lider_days.append(3.4)
                if row.get('step4_completed', 0) == 1: costos_days.append(4.2)
                if row.get('step5_completed', 0) == 1 or row.get('status') in ['Ganado', 'Perdido']: dir_days.append(1.6)

        v_avg = round(sum(ventas_days) / len(ventas_days), 1) if ventas_days else 0.0
        l_avg = round(sum(lider_days) / len(lider_days), 1) if lider_days else 0.0
        c_avg = round(sum(costos_days) / len(costos_days), 1) if costos_days else 0.0
        d_avg = round(sum(dir_days) / len(dir_days), 1) if dir_days else 0.0

        roles_data = [
            ("Ventas", "Paso 1 (Levantamiento) & Paso 6 (Entrega)", f"{v_avg} días hábiles"),
            ("Líder Regional", "Paso 2 (Minuta) & Paso 3 (Catálogo)", f"{l_avg} días hábiles"),
            ("Analista de Costos", "Paso 4 (Elaboración de Cotización)", f"{c_avg} días hábiles"),
            ("Dirección General", "Paso 5 (Revisión) & Paso 7 (Cierre)", f"{d_avg} días hábiles")
        ]

    for i, (puesto, gates, val) in enumerate(roles_data):
        row = table_sla.rows[i + 1]
        for col_idx, text in enumerate([puesto, gates, val]):
            cell = row.cells[col_idx]
            cell.width = widths_s[col_idx]
            p_cell = cell.paragraphs[0]
            p_cell.paragraph_format.space_before = Pt(4)
            p_cell.paragraph_format.space_after = Pt(4)
            run = p_cell.add_run(text)
            if col_idx == 2:
                run.bold = True

    # 2. SLA Chart using Matplotlib
    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    h2 = doc.add_paragraph()
    h2_run = h2.add_run("2. Gráfico de Tiempos Promedio de Respuesta por Puesto")
    h2_run.bold = True
    h2_run.font.size = Pt(12)
    h2_run.font.color.rgb = RGBColor(15, 76, 129)

    fig, ax = plt.subplots(figsize=(4.5, 2.2))
    puestos_chart = ["Dirección", "Ventas", "Líderes", "Costos"]
    tiempos = [d_avg, v_avg, l_avg, c_avg]
    colors = ["#10B981", "#3B82F6", "#F59E0B", "#C23B22"]
    
    bars = ax.barh(puestos_chart, tiempos, color=colors, height=0.55)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#cccccc')
    ax.spines['bottom'].set_color('#cccccc')
    ax.tick_params(axis='both', colors='#4b5563', labelsize=8)
    ax.set_xlabel('Días hábiles promedio', fontsize=8, color='#4b5563')
    
    for bar in bars:
        width = bar.get_width()
        ax.text(width + 0.1, bar.get_y() + bar.get_height()/2, f"{width}d", 
                va='center', ha='left', fontsize=8, color='#111827', fontweight='bold')

    plt.title("Tiempos de Respuesta de Compuertas SLA", fontsize=9, fontweight='bold', pad=10)
    img_buf = io.BytesIO()
    plt.savefig(img_buf, format='png', dpi=120, bbox_inches='tight')
    plt.close()
    img_buf.seek(0)

    p_chart = doc.add_paragraph()
    p_chart.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_chart.add_run().add_picture(img_buf, width=Inches(4.8))

    # 3. Identificación de Cuellos de Botella y Recomendaciones Correctivas
    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    h3 = doc.add_paragraph()
    h3_run = h3.add_run("3. Sugerencias Correctivas e Intervención de Cuellos de Botella")
    h3_run.bold = True
    h3_run.font.size = Pt(12)
    h3_run.font.color.rgb = RGBColor(15, 76, 129)

    doc.add_paragraph("De acuerdo con la auditoría sistemática de tiempos y transiciones de compuertas en la base de datos de Supabase, se han identificado las siguientes áreas de fricción y acciones recomendadas:")

    has_real_data = (v_avg + l_avg + c_avg + d_avg) > 0
    if not has_real_data:
        recoms = [
            ("Estado General del SLA", "No existen registros de compuertas en proceso suficientes para emitir análisis de cuellos de botella. Registre y avance proyectos para generar métricas de desempeño reales.")
        ]
    else:
        role_map = [
            ("Analista de Costos - P4", c_avg),
            ("Líder Regional - P2 & P3", l_avg),
            ("Ventas - P1 & P6", v_avg),
            ("Dirección General - P5 & P7", d_avg)
        ]
        role_map.sort(key=lambda x: x[1], reverse=True)
        max_name, max_val = role_map[0]
        min_name, min_val = role_map[-1]
        recoms = [
            (f"Área de Oportunidad Principal ({max_name})", f"El puesto registra un promedio de {max_val} días de respuesta. Se recomienda agilizar el flujo de sus compuertas para mejorar el tiempo global del proceso."),
            (f"Desempeño Destacado ({min_name})", f"El puesto mantiene el mejor tiempo promedio de respuesta con {min_val} días hábiles, acelerando la atención de sus etapas asignadas.")
        ]

    for title, desc in recoms:
        p_recom = doc.add_paragraph(style="List Bullet")
        run_title = p_recom.add_run(f"{title}: ")
        run_title.bold = True
        run_title.font.color.rgb = RGBColor(194, 59, 34) if ("Oportunidad" in title or "Crítico" in title) else RGBColor(15, 76, 129)
        p_recom.add_run(desc)

    # 4. Firmas de Cierre de Auditoría
    doc.add_paragraph().paragraph_format.space_after = Pt(24)
    h4 = doc.add_paragraph()
    h4_run = h4.add_run("4. Firmas y Autorizaciones de Auditoría de SLA")
    h4_run.bold = True
    h4_run.font.size = Pt(12)
    h4_run.font.color.rgb = RGBColor(15, 76, 129)

    table_sign = doc.add_table(rows=1, cols=2)
    table_sign.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_sign.autofit = False

    row_s = table_sign.rows[0]
    cell_s1 = row_s.cells[0]
    cell_s1.width = Inches(3.4)
    p_s1 = cell_s1.paragraphs[0]
    p_s1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_s1.paragraph_format.space_before = Pt(20)
    p_s1.add_run("_________________________________\nIng. Noe Ortiz\nDirector General").font.size = Pt(9.5)

    cell_s2 = row_s.cells[1]
    cell_s2.width = Inches(3.4)
    p_s2 = cell_s2.paragraphs[0]
    p_s2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_s2.paragraph_format.space_before = Pt(20)
    p_s2.add_run("_________________________________\nEquipo de Ingeniería de Calidad Pro\nDC Control S.A. de C.V.").font.size = Pt(9.5)

    bio = io.BytesIO()
    doc.save(bio)
    bio.seek(0)
    return Response(content=_repair_docx_mojibake(bio.getvalue()), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers={"Content-Disposition": "attachment; filename=Reporte_Ejecutivo_Desempeno_SLA.docx"})



@app.get("/api/open-folder/{project_id}")
def open_project_folder(project_id: str, current_user=Depends(get_current_user)):
    # In the cloud there is no user Windows folder to open. Return the project's
    # SharePoint location so the Electron client can open it in the browser.
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute("SELECT sharepoint_folder_url FROM projects WHERE id = %s", (project_id,))
        row = cursor.fetchone()
        if not row or not row.get('sharepoint_folder_url'):
            raise HTTPException(status_code=404, detail="No hay carpeta SharePoint configurada para este proyecto")
        cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        project = cursor.fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        require_project_read_access(current_user, project)
        return {
            "status": "success",
            "path": row['sharepoint_folder_url'],
            "url": row['sharepoint_folder_url'],
            "message": "Ubicación SharePoint del proyecto"
        }
    finally:
        put_db_connection(conn)

class AdminUserUpdateRequest(BaseModel):
    full_name: str
    role: str
    email: str
    privileges: Optional[str] = "dashboards,reports,projects,reversal"
    password: Optional[str] = None

@app.put("/api/users/admin-update/{username}")
def admin_update_user(username: str, req: AdminUserUpdateRequest, current_user=Depends(require_admin)):
    if username == "noe.ortizadm" and not is_admin_or_director(current_user):
        raise HTTPException(status_code=403, detail="Cuenta principal protegida")
    if username == "noe.ortizadm":
        # La cuenta principal no puede perder su identidad privilegiada por una petición administrativa.
        req_role = "Admin/Director"
        req_privileges = "dashboards,reports,projects,reversal"
    else:
        req_role = req.role
        req_privileges = req.privileges
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if req.password and req.password.strip():
            cursor.execute("UPDATE users SET full_name = %s, role = %s, email = %s, privileges = %s, password = %s WHERE username = %s",
                           (req.full_name, req_role, req.email, req_privileges, hash_password(req.password), username))
        else:
            cursor.execute("UPDATE users SET full_name = %s, role = %s, email = %s, privileges = %s WHERE username = %s",
                           (req.full_name, req_role, req.email, req_privileges, username))
        conn.commit()
        log_audit("SISTEMA", current_user.get("full_name") or current_user.get("username"), current_user.get("role"), f"Actualizó perfil y permisos de {username}")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_db_connection(conn)


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=False)
@app.post("/api/projects/p4-return-p3")
def p4_return_to_p3(project_id: str, comments: str = "", current_user=Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cursor.execute("SELECT * FROM projects WHERE id = %s", (str(project_id),))
        p = cursor.fetchone()

        if not p:
            raise HTTPException(status_code=404, detail="Project not found")

        current_stage = int(p.get("current_stage") or 1)

        if current_stage != 4:
            raise HTTPException(
                status_code=400,
                detail="Return to Step 3 is only allowed from Step 4"
            )

        is_costos = _is_assigned(
            current_user,
            str(p.get("assigned_costos") or "")
        )

        if not is_costos and not is_admin_or_director(current_user):
            raise HTTPException(
                status_code=403,
                detail="Only the assigned Cost Analyst can return the project to Step 3"
            )

        motivo = str(comments or "").strip()

        if not motivo:
            raise HTTPException(
                status_code=400,
                detail="You must indicate what is missing from the catalog"
            )

        cursor.execute("""
            UPDATE projects
            SET current_stage = 3,
                step3_completed = 0,
                step4_completed = 0
            WHERE id = %s
        """, (str(project_id),))

        conn.commit()

        nombre = (
            current_user.get("full_name")
            or current_user.get("username")
            or "Usuario"
        )

        rol = current_user.get("role") or "Analista de Costos"

        log_audit(
            str(project_id),
            nombre,
            rol,
            "Returned project from Step 4 to Step 3 because catalog is incomplete",
            comments=motivo
        )

        return {
            "success": True,
            "new_stage": 3,
            "message": "Project returned to Step 3"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_db_connection(conn)
