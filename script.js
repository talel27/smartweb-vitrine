// Animation apparition au scroll
const elements = document.querySelectorAll(".card, .section h2");

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = 1;
            entry.target.style.transform = "translateY(0)";
        }
    });
}, { threshold: 0.2 });

elements.forEach(el => {
    el.style.opacity = 0;
    el.style.transform = "translateY(40px)";
    el.style.transition = "all 0.8s ease";
    observer.observe(el);
});


// Message après envoi formulaire
const form = document.querySelector(".contact-form");

if (form) {
    form.addEventListener("submit", function(e) {
        e.preventDefault();
        alert("Message envoyé avec succès !");
        form.reset();
    });
}


// Bouton retour en haut
const scrollBtn = document.createElement("button");
scrollBtn.innerText = "↑";
scrollBtn.style.position = "fixed";
scrollBtn.style.bottom = "20px";
scrollBtn.style.right = "20px";
scrollBtn.style.padding = "10px 15px";
scrollBtn.style.borderRadius = "50%";
scrollBtn.style.border = "none";
scrollBtn.style.background = "#0072ff";
scrollBtn.style.color = "white";
scrollBtn.style.cursor = "pointer";
scrollBtn.style.display = "none";
document.body.appendChild(scrollBtn);

window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
        scrollBtn.style.display = "block";
    } else {
        scrollBtn.style.display = "none";
    }
});

scrollBtn.addEventListener("click", () => {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});
