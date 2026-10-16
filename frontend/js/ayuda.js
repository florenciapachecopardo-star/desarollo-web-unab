// Abre y resalta la pregunta indicada en ?tema= (por ejemplo, ?tema=despachos).

document.addEventListener("DOMContentLoaded", () => {
    const tema = new URLSearchParams(window.location.search).get("tema");
    if (!tema) return;

    const bloque = document.querySelector(`.faq[data-tema="${tema}"]`);
    if (bloque) {
        bloque.open = true;
        bloque.scrollIntoView({ behavior: "smooth", block: "center" });
    }
});
