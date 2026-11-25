/*
 * Catálogo de films.
 * Para cargar un video real, completá `video` con alguno de estos formatos:
 *   { type: "vimeo",   id: "123456789" }
 *   { type: "youtube", id: "dQw4w9WgXcQ" }
 *   { type: "file",    src: "assets/videos/pareja.mp4" }
 * y `poster` con la miniatura (ej. "assets/posters/pareja.jpg").
 * `category`: "boda" | "elopement" | "preboda" | "destino"
 * `featured: true` lo muestra en la home.
 */
window.FILMS = [
  { title: "Sofía & Martín",   place: "Estancia, Buenos Aires",      category: "boda",      tone: "warm", featured: true, video: null, poster: null },
  { title: "Lucía & Tomás",    place: "Bodega, Mendoza",             category: "boda",      tone: "",     featured: true, video: null, poster: null },
  { title: "Carla & Nico",     place: "Playa, José Ignacio",         category: "destino",   tone: "cool", featured: true, video: null, poster: null },
  { title: "Valen & Joaquín",  place: "Sierras, Córdoba",            category: "elopement", tone: "warm", video: null, poster: null },
  { title: "Juli & Fede",      place: "Palermo, Buenos Aires",       category: "preboda",   tone: "cool", video: null, poster: null },
  { title: "Ana & Pablo",      place: "Toscana, Italia",             category: "destino",   tone: "",     video: null, poster: null },
  { title: "Mica & Santi",     place: "Quinta, Pilar",               category: "boda",      tone: "warm", video: null, poster: null },
  { title: "Flor & Agus",      place: "Bariloche, Río Negro",        category: "elopement", tone: "cool", video: null, poster: null },
  { title: "Delfi & Ramiro",   place: "Colonia, Uruguay",            category: "boda",      tone: "",     video: null, poster: null },
];

window.FILM_CATEGORIES = {
  boda: "Bodas",
  elopement: "Elopement",
  preboda: "Preboda",
  destino: "Destino",
};
