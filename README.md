## Backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
# Copiar .env.example → .env y rellenar credenciales
uvicorn app.main:app --reload

## Frontend
cd frontend/kai-project
npm install
npm run dev


## El dump con los datos no se sube a GitHub
## se comparte aparte (USB, Drive, etc.) y quien descargue el repo lo pone en backend/backup.sql antes de ejecutar.