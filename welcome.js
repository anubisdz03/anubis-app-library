document.addEventListener("DOMContentLoaded", () => {

if(localStorage.getItem("anubis_welcome")) return;

const html=`
<div class="welcome-overlay show" id="welcomeOverlay">
<div class="welcome-box">


<h2>👋 Welcome | مرحبًا بك</h2>

<p>
<b>ANUBIS APP LIBRARY</b><br><br>

Your destination for the best entertainment apps for:

<br><br>

Android TV
<br>
Google TV

<br><br>

📺 New apps are added regularly.
<br>
🚀 Stay tuned for the latest updates.

<br><br>

━━━━━━━━━━━━━━━━━━━━

<br><br>

وجهتك لأفضل التطبيقات الترفيهية لـ

<br><br>

Android TV
<br>
Google TV

<br><br>

📺 يتم إضافة تطبيقات جديدة باستمرار.
<br>
🚀 تابع آخر التحديثات أولًا بأول.

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
