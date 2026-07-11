document.addEventListener("DOMContentLoaded", () => {

if(localStorage.getItem("anubis_welcome")) return;

const html=`
<div class="welcome-overlay show" id="welcomeOverlay">
<div class="welcome-box">


<h2>👋 Welcome | مرحبًا بك</h2>

<p>
<b>ANUBIS APP LIBRARY</b><br><br>

🇬🇧 Your destination for the best entertainment apps
for Android TV & Google TV.
<br><br>
🇸🇦 وجهتك لأفضل التطبيقات الترفيهية
لأجهزة Android TV و Google TV.
</p>

<button class="welcome-btn" id="welcomeClose">
🚀 Start Browsing
</button>
</div>
</div>
`;

document.body.insertAdjacentHTML("beforeend",html);

document.getElementById("welcomeClose").onclick=()=>{
document.getElementById("welcomeOverlay").remove();
localStorage.setItem("anubis_welcome","1");
};

});
