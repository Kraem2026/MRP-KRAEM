// config.js - Configuración Central de Supabase para KRAEM MRP
const _supabaseUrl = 'https://telntsrrschcdxczlape.supabase.co';
const _supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlbG50c3Jyc2NoY2R4Y3psYXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjI4MTcsImV4cCI6MjA4MDQzODgxN30.DC2teZ_4gk3wA7UmZJHyeZHjw5aOOEmmKvd3a8jRUyw';

const client = supabase.createClient(_supabaseUrl, _supabaseKey);

// Función global para cambiar el tema
function toggleTheme() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    if (document.getElementById('themeIcon')) {
        document.getElementById('themeIcon').className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    }
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// Cargar tema guardado al iniciar
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    if (document.getElementById('themeIcon')) {
        document.getElementById('themeIcon').className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
});
