import pandas as pd
import psycopg2
from neo4j import GraphDatabase
import os
from datetime import datetime
import traceback
import io

# Database Connections
PG_URL = "postgresql://pulsegov:pulsegov123@localhost:5432/pulsegov"
NEO4J_URL = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASS = "pulsegov123"

CSV_PATH = r"D:\Sem_III\MDM\complaints.csv"

def ingest():
    print(f"🚀 Starting advanced ingestion from {CSV_PATH}...")
    
    try:
        # Load and Split CSV into sections
        with open(CSV_PATH, 'r') as f:
            content = f.read()
        
        parts = content.split('\n\n')
        sections = {}
        
        for part in parts:
            part = part.strip()
            if not part: continue
            
            # Use io.StringIO to read the CSV snippet
            df = pd.read_csv(io.StringIO(part))
            if 'email' in df.columns:
                sections['users'] = df
            elif 'from_officer_id' in df.columns:
                sections['escalations'] = df
            elif 'channel' in df.columns:
                sections['notifications'] = df
            elif 'performed_by' in df.columns:
                sections['history'] = df
            elif 'complaint_id' in df.columns and 'citizen_id' in df.columns:
                sections['complaints'] = df

        # Connect to PostgreSQL
        pg_conn = psycopg2.connect(PG_URL)
        pg_cur = pg_conn.cursor()

        # 1. Sync Users
        if 'users' in sections:
            print("👤 Syncing Users...")
            user_df = sections['users']
            for _, row in user_df.iterrows():
                pg_cur.execute(
                    """INSERT INTO users (id, email, password_hash, name, phone, role, department_id, rating)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT (id) DO UPDATE SET
                       email = EXCLUDED.email,
                       name = EXCLUDED.name,
                       phone = EXCLUDED.phone,
                       role = EXCLUDED.role,
                       department_id = EXCLUDED.department_id,
                       rating = EXCLUDED.rating""",
                    (
                        int(row['id']),
                        row['email'],
                        "$2b$10$abcdefghijklmnopqrstuvwxyz", # Default hash for samples
                        row['name'],
                        row['phone'],
                        row['role'],
                        int(row['department_id']) if not pd.isna(row['department_id']) else None,
                        float(row['rating']) if not pd.isna(row['rating']) else 0.0
                    )
                )

        # 2. Sync Complaints (if present)
        if 'complaints' in sections:
            print("📝 Syncing Complaints...")
            complaint_df = sections['complaints']
            for _, row in complaint_df.iterrows():
                pg_cur.execute(
                    """INSERT INTO complaints 
                       (id, complaint_id, citizen_id, title, description, category_id, department_id, assigned_officer_id, priority, status, created_at, sla_deadline)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT (complaint_id) DO NOTHING""",
                    (
                        int(row['id']),
                        row['complaint_id'],
                        int(row['citizen_id']),
                        f"Sample: {row['complaint_id']}",
                        "Ingested from sample CSV file.",
                        int(row['category_id']),
                        int(row['department_id']),
                        int(row['assigned_officer_id']) if not pd.isna(row['assigned_officer_id']) else None,
                        row['priority'],
                        row['status'],
                        row['created_at'],
                        row['sla_deadline']
                    )
                )

        # 3. Sync Escalations
        if 'escalations' in sections:
            print("📈 Syncing Escalations...")
            esc_df = sections['escalations']
            for _, row in esc_df.iterrows():
                pg_cur.execute(
                    """INSERT INTO escalations (id, complaint_id, from_officer_id, to_officer_id, level, reason, auto_escalated)
                       VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
                    (
                        int(row['id']),
                        int(row['complaint_id']),
                        int(row['from_officer_id']) if not pd.isna(row['from_officer_id']) else None,
                        int(row['to_officer_id']),
                        int(row['level']),
                        row['reason'],
                        row['auto_escalated'] == 'true' or row['auto_escalated'] == True
                    )
                )

        # 4. Sync Notifications
        if 'notifications' in sections:
            print("🔔 Syncing Notifications...")
            notif_df = sections['notifications']
            for _, row in notif_df.iterrows():
                pg_cur.execute(
                    """INSERT INTO notifications (id, user_id, complaint_id, type, channel, message, sent)
                       VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
                    (
                        int(row['id']),
                        int(row['user_id']),
                        int(row['complaint_id']),
                        row['type'],
                        row['channel'],
                        row['message'],
                        row['sent'] == 'true' or row['sent'] == True
                    )
                )

        # 5. Sync History
        if 'history' in sections:
            print("📜 Syncing Complaint History...")
            hist_df = sections['history']
            for _, row in hist_df.iterrows():
                pg_cur.execute(
                    """INSERT INTO complaint_history (id, complaint_id, action, performed_by, created_at)
                       VALUES (%s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
                    (
                        int(row['id']),
                        int(row['complaint_id']),
                        row['action'],
                        int(row['performed_by']),
                        row['created_at']
                    )
                )

        pg_conn.commit()
        print("✅ Ingestion successfully completed!")
        pg_conn.close()

    except Exception as e:
        print("❌ CRITICAL ERROR DURING INGESTION:")
        traceback.print_exc()

if __name__ == "__main__":
    ingest()
