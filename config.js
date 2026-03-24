// CONFIGURACIÓN DE CONEXIÓN
const CONFIG = {
    URL: "https://tkgycflluccogcugcljn.supabase.co",
    KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrZ3ljZmxsdWNjb2djdWdjbGpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjE1MDgsImV4cCI6MjA4OTkzNzUwOH0.kdRq0INWkCyDk-bZ_bBFKel5UlmZWeSo3PjQk5nIZ9Q"
};

// Creamos el cliente que usarán todos los archivos
const _client = supabase.createClient(CONFIG.URL, CONFIG.KEY);