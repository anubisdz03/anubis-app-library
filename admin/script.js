const { createClient } = window.supabase;

const supabaseUrl = "https://ypszdzznqaizopfulioa.supabase.co";
const supabaseKey = "sb_publishable_EKEuf19RbGaaQ_xjN9VmhA_mkOY9t2q";

const supabaseClient = createClient(supabaseUrl, supabaseKey);

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("login-email");
const passwordInput = document.getElementById("login-password");
const errorBox = document.getElementById("login-error");

errorBox.style.display = "none";

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorBox.style.display = "none";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value,
  });

  if (error) {
    errorBox.textContent = error.message;
    errorBox.style.display = "block";
    return;
  }

  window.location.href = "index.html";
});