let deferredPrompt = null;

// Admin Install Logic
export function initAdminPwaInstall(buttonId = "installBtn") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../sw.js", { scope: "/" }).catch(() => {});
  }
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.classList.add("hidden");
  if (window.matchMedia("(display-mode: standalone)").matches) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.classList.remove("hidden");
  });
  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.classList.add("hidden");
  });
  window.addEventListener("appinstalled", () => btn.classList.add("hidden"));
}

// Student Mandatory Install Logic (Strict 40s Demo Timer)
export function initStudentMandatoryInstall(overlayId, installBtnId, appShellId) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "/" }).catch(() => {});
  }

  const overlay = document.getElementById(overlayId);
  const btn = document.getElementById(installBtnId);
  const appShell = document.getElementById(appShellId);

  // Check if app is opened from home screen
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  
  if (isStandalone) {
     overlay.style.display = "none";
     appShell.style.display = "block";
     return;
  } else {
     overlay.style.display = "flex";
     appShell.style.display = "none";
  }

  let promptFired = false;
  let isInstallingAnimationRunning = false; 

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    promptFired = true;
    btn.disabled = false;
    btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> অ্যাপটি ইনস্টল করুন`;
  });

  btn.addEventListener("click", async () => {
    if (!deferredPrompt) {
       alert("আপনার ব্রাউজারে অটোমেটিক ইনস্টল সাপোর্ট নেই। পেজটি একবার রিলোড করে আবার চেষ্টা করুন।");
       return;
    }
    
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    
    if (choiceResult.outcome === "accepted") { 
        deferredPrompt = null; 
        isInstallingAnimationRunning = true; 
        
        // --- Strict 40 Seconds Demo Progress Bar ---
        const installCard = document.querySelector('.install-card');
        installCard.innerHTML = `
          <div class="app-icon-placeholder" style="margin: 0 auto 20px; animation: pulse 1.5s infinite;">
            <img src="./icon-192.png" alt="App Icon" style="width:100%; height:100%; border-radius:22px; object-fit:cover;" onerror="this.style.display='none'">
          </div>
          <h2 class="install-title" style="font-size: 1.4rem;">ইন্সটল হচ্ছে...</h2>
          <p class="install-desc" style="margin-bottom: 24px; font-size: 0.9rem;">অনুগ্রহ করে অপেক্ষা করুন, আপনার ফোনে অ্যাপটি তৈরি করা হচ্ছে।</p>
          
          <div style="width: 100%; background: rgba(128,128,128,0.15); border-radius: 12px; height: 12px; overflow: hidden; position: relative; margin-bottom: 12px;">
              <div id="installProgressBar" style="width: 0%; height: 100%; background: linear-gradient(135deg, var(--color-accent), #f59e0b); border-radius: 12px; transition: width 0.1s linear;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary); font-weight: 700;">
              <span id="installProgressText">0%</span>
              <span id="installTimeLeft">ডাউনলোড শুরু হচ্ছে...</span>
          </div>
        `;

        const progressBar = document.getElementById('installProgressBar');
        const progressText = document.getElementById('installProgressText');
        const timeLeftText = document.getElementById('installTimeLeft');

        let progress = 0;
        const totalTime = 40; // বাধ্যতামূলক ৪০ সেকেন্ডের টাইমার
        
        const interval = setInterval(() => {
            progress += (100 / (totalTime * 10)); // প্রতি 100ms এ একটু একটু করে বাড়বে
            if (progress >= 100) progress = 100;

            progressBar.style.width = `${progress}%`;
            progressText.innerText = `${Math.floor(progress)}%`;

            // বাকি থাকা সেকেন্ড হিসাব করা
            let sec = Math.ceil(totalTime - (progress / (100/totalTime)));
            if (sec < 0) sec = 0;

            // প্রোগ্রেস অনুযায়ী লেখাগুলো বদলাবে (৪০ সেকেন্ডের সাথে মানানসই করে)
            if (progress > 2 && progress < 75) {
                timeLeftText.innerText = `ডাউনলোড হচ্ছে... (${sec}s)`;
            } else if (progress >= 75 && progress < 98) {
                timeLeftText.innerText = `সেটআপ করা হচ্ছে... (${sec}s)`;
            } else if (progress >= 98) {
                timeLeftText.innerText = `সম্পন্ন হচ্ছে...`;
            }

            // শুধুমাত্র টাইমার ১০০% হলেই সাকসেস মেসেজ আসবে
            if (progress >= 100) {
                clearInterval(interval);
                isInstallingAnimationRunning = false; 
                showSuccessUI();
            }
        }, 100);

    } else {
        deferredPrompt = null;
        alert("আপনি ইনস্টল ক্যানসেল করেছেন। আবার ইনস্টল করতে চাইলে পেজটি রিফ্রেশ করুন।");
    }
  });

  // ক্রোম আগেই ইনস্টল সিগন্যাল দিলেও আমরা পাত্তা দেবো না। 
  window.addEventListener("appinstalled", () => {
     if (!isInstallingAnimationRunning) {
         showSuccessUI();
     }
  });

  function showSuccessUI() {
     overlay.innerHTML = `
       <div class="install-card" style="animation: slideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);">
         <div class="app-icon-placeholder" style="margin: 0 auto 20px;">
           <img src="./icon-192.png?v=2" alt="App Icon" style="width:100%; height:100%; border-radius:22px; object-fit:cover;" onerror="this.style.display='none'">
         </div>
         <h2 class="install-title">Physics Lover 2.0</h2>
         <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:16px; padding:24px; margin-top:20px;">
           <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
           <p style="color:var(--text-primary); font-size:1.1rem; font-weight:900; line-height:1.5;">অ্যাপটি ফোনে ইনস্টল হয়ে গেছে!</p>
           <p style="color:var(--text-secondary); margin-top:10px; font-size:0.95rem; font-weight:600;">দয়া করে এই ব্রাউজারটি কেটে দিন এবং আপনার ফোনের হোমস্ক্রিন থেকে অ্যাপটি খুলুন।</p>
         </div>
       </div>
     `;
  }

  setTimeout(() => {
    if(!promptFired) {
       btn.disabled = false;
       btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg> ম্যানুয়ালি ইনস্টল করুন`;
    }
  }, 3000);
}
