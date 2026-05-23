import pandas as pd
import psycopg2
from neo4j import GraphDatabase
import os
from datetime import datetime
import traceback

# Database Connections
PG_URL = "postgresql://pulsegov:pulsegov123@localhost:5432/pulsegov"
NEO4J_URL = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASS = "pulsegov123"

CSV_PATH = r"D:\Sem_III\MDM\complaints.csv"

def ingest():
    print(f"🚀 Starting ingestion from {CSV_PATH}...")
    
    try:
        # Load CSV
        df = pd.read_csv(CSV_PATH)
        print(f"📊 Loaded {len(df)} records from CSV.")
        
        # Robust Numeric Conversion
        df['id'] = pd.to_numeric(df['id'], errors='coerce')
        df['citizen_id'] = pd.to_numeric(df['citizen_id'], errors='coerce')
        df['category_id'] = pd.to_numeric(df['category_id'], errors='coerce')
        df['department_id'] = pd.to_numeric(df['department_id'], errors='coerce')
        df['assigned_officer_id'] = pd.to_numeric(df['assigned_officer_id'], errors='coerce')
        
        # Drop rows where critical IDs are missing
        initial_len = len(df)
        df = df.dropna(subset=['id', 'citizen_id', 'category_id', 'department_id'])
        if len(df) < initial_len:
            print(f"⚠️ Dropped {initial_len - len(df)} rows due to missing critical IDs.")

        # Connect to PostgreSQL
        pg_conn = psycopg2.connect(PG_URL)
        pg_cur = pg_conn.cursor()

        # Connect to Neo4j
        neo4j_driver = GraphDatabase.driver(NEO4J_URL, auth=(NEO4J_USER, NEO4J_PASS))

        # 1. Fetch Categories and Departments for mapping
        pg_cur.execute("SELECT id, name FROM categories")
        categories = {row[0]: row[1] for row in pg_cur.fetchall()}
        
        pg_cur.execute("SELECT id, name FROM departments")
        departments = {row[0]: row[1] for row in pg_cur.fetchall()}

        # 2. Ensure Users (Citizens and Officers) exist
        unique_citizens = df['citizen_id'].unique()
        unique_officers = df['assigned_officer_id'].unique()

        print("👤 Checking/Creating users...")
        for uid in unique_citizens:
            uid_int = int(uid)
            pg_cur.execute("SELECT id FROM users WHERE id = %s", (uid_int,))
            if not pg_cur.fetchone():
                pg_cur.execute(
                    "INSERT INTO users (id, email, password_hash, name, role) VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
                    (uid_int, f"citizen_{uid_int}@example.com", "hashed_pass", f"Citizen {uid_int}", "citizen")
                )
        
        for uid in unique_officers:
            if pd.isna(uid): continue
            uid_int = int(uid)
            pg_cur.execute("SELECT id FROM users WHERE id = %s", (uid_int,))
            if not pg_cur.fetchone():
                match = df[df['assigned_officer_id'] == uid]
                dept_id = int(match['department_id'].iloc[0]) if not match.empty else 1
                pg_cur.execute(
                    "INSERT INTO users (id, email, password_hash, name, role, department_id) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
                    (uid_int, f"officer_{uid_int}@gov.in", "hashed_pass", f"Officer {uid_int}", "officer", dept_id)
                )
        
        pg_conn.commit()

        # 3. Insert Complaints
        print("📝 Inserting complaints (first 5000 for stability)...")
        for index, row in df.head(5000).iterrows():
            try:
                complaint_id_str = str(row['complaint_id'])
                cat_name = categories.get(int(row['category_id']), "General Issue")
                title = f"Historical: {cat_name} report"
                description = f"Historical data entry for {cat_name}. Status: {row['status']}."

                # Insert into Postgres
                pg_cur.execute(
                    """INSERT INTO complaints 
                       (id, complaint_id, citizen_id, title, description, category_id, department_id, assigned_officer_id, priority, status, created_at, sla_deadline)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (complaint_id) DO NOTHING RETURNING id""",
                    (
                        int(row['id']),
                        complaint_id_str,
                        int(row['citizen_id']),
                        title,
                        description,
                        int(row['category_id']),
                        int(row['department_id']),
                        int(row['assigned_officer_id']) if not pd.isna(row['assigned_officer_id']) else None,
                        row['priority'],
                        row['status'],
                        row['created_at'],
                        row['sla_deadline']
                    )
                )
                
                res = pg_cur.fetchone()
                db_id = res[0] if res else int(row['id'])

                # Add to Neo4j
                with neo4j_driver.session() as session:
                    session.run(
                        """
                        MERGE (c:Complaint {id: $id})
                        SET c.complaint_id = $complaint_id,
                            c.title = $title,
                            c.description = $description,
                            c.category_id = $category_id,
                            c.created_at = datetime($created_at)
                        
                        MERGE (cat:Category {id: $category_id})
                        SET cat.name = $category_name
                        
                        MERGE (u:Citizen {id: $citizen_id})
                        MERGE (c)-[:SUBMITTED_BY]->(u)
                        MERGE (c)-[:BELONGS_TO]->(cat)
                        """,
                        {
                            "id": db_id,
                            "complaint_id": complaint_id_str,
                            "title": title,
                            "description": description,
                            "category_id": int(row['category_id']),
                            "category_name": cat_name,
                            "citizen_id": int(row['citizen_id']),
                            "created_at": str(row['created_at']).replace(' ', 'T') if ' ' in str(row['created_at']) else str(row['created_at'])
                        }
                    )

            except Exception as e:
                # print(f"⚠️ Error inserting index {index}: {e}")
                pg_conn.rollback()
                continue
            
            pg_conn.commit()
            if index > 0 and index % 500 == 0:
                print(f"✅ Processed {index} records...")

        print("✅ Ingestion complete!")
        pg_conn.close()
        neo4j_driver.close()

    except Exception as e:
        print("❌ CRITICAL ERROR:")
        traceback.print_exc()

if __name__ == "__main__":
    ingest()
