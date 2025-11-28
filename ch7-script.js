/* eslint-disable no-case-declarations */
/* eslint-disable no-undef */
function isEmailAlreadyInUse(resp) {
  const msg = `${resp?.message || ""} ${resp?.error || ""}`.toLowerCase();
  return (
    msg.includes("already in use") || msg.includes("auth/email-already-in-use")
  );
}
const dictionary = {
  "error.namePrefix": "Bitte wähle deine Anrede aus",
  "error.firstName": "Bitte gib deinen Vornamen ein",
  "error.lastName": "Bitte gib deinen Nachnamen ein",
  "error.dateOfBirth": "Bitte gib dein Geburtsdatum ein",
  "error.email": "Bitte gib deine E-Mail-Adresse ein",
  "error.emailInvalid": "Bitte gib eine gültige E-Mail-Adresse ein",
  "error.password": "Bitte gib ein Passwort ein",
  "error.passwordLength": "Dein Passwort muss mindestens 6 Zeichen lang sein",
  "error.ageRestriction": "Du musst mindestens 18 Jahre alt sein",
  "error.termsAndConditions": "Bitte stimme den Nutzungsbedingungen zu",
  "error.privacyPolicy": "Bitte stimme den AGB zu",
  "error.requiredFields": "Bitte fülle alle erforderlichen Felder aus",
  "error.healthProvider": "Bitte wähle deine Krankenkasse aus",
  "error.selectOptions": "Bitte wähle mehr als eine Option aus",
  "error.tooManyOptions": "Du kannst maximal 2 Programme auswählen",
  "error.selectPrograms": "Bitte wähle mindestens ein Programm aus",
  "error.agreeToTerms": "Bitte stimme beiden Bedingungen zu",
  "select.healthProvider": "Bitte wähle deine Krankenkasse",
  "payment.processing": "Wird bearbeitet ...",
  "payment.payNow": "Jetzt bezahlen",
  "payment.discount": "Rabatt",
  "button.next": "Weiter",
  "button.back": "Zurück",
  "button.submit": "Absenden",
  "error.payment": "Es ist ein Zahlungsfehler aufgetreten",
  "error.paymentIncomplete":
    "Die Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
  "error.invoice": "Die Rechnung konnte nicht erstellt werden",
  "error.userCreation": "Fehler beim Erstellen deines Benutzerkontos",
  "error.validation": "Bitte überprüfe deine Eingaben",
  "success.registration": "Registrierung erfolgreich",
  "success.payment": "Zahlung erfolgreich",
  "success.invoice": "Rechnung wurde erstellt und per E-Mail versandt",
  "button.closePayment": "Zahlungsfenster schließen",
  "error.userExistsNoLocal":
    "Dieser Benutzer existiert bereits. Bitte beende die Einrichtung in der mobilen App",
};


const PUBLISHABLE_KEY =
  "pk_test_51QPhSmIjMlCwpKLpOSWig7J6FCQyFQ5NEysG3mXGy5tzXfZ61wwdGDSU2m6qPO8QwWeUMokteES3SyTUJlqJF6JP00zRyrYPId";

API = "https://europe-west3-preneo-production.cloudfunctions.net";
const API_URL = API;

let stripe;

const CURRENCY = "€";
const DEFAULT_CHECKMARK_COLOR = "#E5E7EB";

/* -------------------- utils -------------------- */
function getSiblingButtonBySelector(selector, childSelector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const parent = el.parentElement.parentElement;
  if (!parent) return null;
  return parent.querySelector(childSelector);
}

function getSubmitButton() {
  const button = document.querySelector("[data-btn-submit]") ||
                 document.querySelector("#registerFormSubmitButton")?.closest("button") ||
                 document.querySelector("button:has(.btn_main_text)");
  return button;
}

function getSubmitButtonText() {
  return getSiblingButtonBySelector("#registerFormSubmitButton", ".btn_main_text");
}

function setSubmitButtonLoading(loading) {
  const button = getSubmitButton();
  const buttonText = getSubmitButtonText();
  
  if (button) {
    if (loading) {
      button.disabled = true;
      button.classList.add("disabled");
      button.setAttribute("aria-disabled", "true");
    } else {
      button.disabled = false;
      button.classList.remove("disabled");
      button.removeAttribute("aria-disabled");
    }
  }
  
  if (buttonText) {
    if (loading) {
      buttonText.textContent = dictionary["payment.processing"];
    } else {
      const originalText = buttonText.getAttribute("data-original-text") || dictionary["payment.payNow"];
      buttonText.textContent = originalText;
    }
  }
}

function getDocumentFromFireBase(document) {
  return `${API}/getConfigData?document=${document}`;
}
function getNamePrefixes() {
  return `${API}/getConfigData?document=namePrefixes`;
}
function getCreateUserBaseUrl() {
  return `${API}/createUser`;
}
function getWebflowStory(slug) {
  return `${API}/getWebflowStory?slug=${slug}&draft=true`;
}

function getVerifyEmailUrl() {
  return `${API}/verify-email`;
}
function getIsEmailVerifiedUrl(userId) {
  return `${API}/is-email-verified?userId=${encodeURIComponent(userId)}`;
}

function getFromStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return defaultValue;
  }
}
function setToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage:`, e);
  }
}

function extractAmount(hp) {
  if (hp && hp.maxCoursePrice != null && hp.maxCoursePrice !== "") {
    const v = String(hp.maxCoursePrice).trim();
    return /€/.test(v) ? v : `${v}€`;
  }
  const m = (hp?.takeover || "").match(/(\d+[.,]?\d*)\s*€/);
  return m ? `${m[1]}€` : "—";
}

function updateInfoBox(selectedProvider) {
  const hp = getFromStorage("healthProviders", {})[selectedProvider] || {};
  const nameEl = document.querySelector("#hp_name");
  const amountEl = document.querySelector("#hp_amount");
  if (nameEl) nameEl.textContent = selectedProvider || "—";
  if (amountEl) amountEl.textContent = extractAmount(hp);
}
function getUserIdSafe() {
  const fromCreate = getFromStorage("createUserResponse", null);
  if (
    fromCreate &&
    typeof fromCreate.userId === "string" &&
    fromCreate.userId.length > 0
  ) {
    return fromCreate.userId;
  }
  const fromKey = getFromStorage("userId", null);
  if (typeof fromKey === "string" && fromKey.length > 0) return fromKey;

  return null;
}

function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

function createFullscreenLoader() {
  let loader = document.getElementById("fullscreen-loader");
  if (loader) return loader;

  loader = document.createElement("div");
  loader.id = "fullscreen-loader";
  loader.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9990;
  `;

  const spinner = document.createElement("div");
  spinner.style.cssText = `
    width: 50px;
    height: 50px;
    border: 4px solid rgba(255, 242, 54, 0.3);
    border-top-color: #FFF236;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  `;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  loader.appendChild(spinner);
  document.body.appendChild(loader);
  return loader;
}

function showFullscreenLoader() {
  const loader = createFullscreenLoader();
  loader.style.display = "flex";
}

function hideFullscreenLoader() {
  const loader = document.getElementById("fullscreen-loader");
  if (loader) {
    loader.style.display = "none";
  }
}

function clearLocalStorageAfterPayment() {
  const keysToRemove = [
    "currentStep",
    "userData",
    "healthProviders",
    "selectedHealthProvider",
    "pricing",
    "contraindications",
    "courses",
    "onboardingSurvey",
    "onboardingSurveyAnswers_1",
    "onboardingSurveyAnswers_2",
    "SurveyAnswersCourseTypes",
    "recommendedCourses",
    "selectedCourses",
    "trial",
    "invoiceUrl",
    "paymentIntentPayload",
    "paymentIntentResponse",
    "paymentSuccess",
    "createUserPayload",
    "createUserResponse",
    "userId",
  ];

  keysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to remove ${key} from localStorage:`, e);
    }
  });
}

async function triggerFormSubmissionFlow(showLoader = false) {
  const form = document.getElementById("signUpForm");
  if (!form) {
    console.warn("Form not found, waiting...");
    setTimeout(() => triggerFormSubmissionFlow(showLoader), 500);
    return;
  }

  const userData = getFromStorage("userData", {});
  if (!userData.email || !userData.firstName || !userData.lastName) {
    console.warn("Form data not complete, cannot auto-submit");
    if (showLoader) hideFullscreenLoader();
    return;
  }

  if (showLoader) {
    showFullscreenLoader();
  }

  const buttonText = getSubmitButtonText();
  if (buttonText && !buttonText.getAttribute("data-original-text")) {
    buttonText.setAttribute("data-original-text", buttonText.textContent);
  }

  setSubmitButtonLoading(true);

  try {
    const userId = getUserIdSafe();
    const formData = { ...userData };
    
    if (userId && formData.password) {
      delete formData.password;
    }
    
    saveFormData(formData);

    if (getFromStorage("trial", false)) {
      await createTrialUser(showLoader);
      return;
    }

    await createUser();
    await ensureEmailVerifiedThenPay(calculateTotalPrice(), showLoader);
  } catch (error) {
    console.error("Auto-submit error:", error);
    setSubmitButtonLoading(false);
    if (showLoader) hideFullscreenLoader();
  }
}

function saveCurrentStep(stepIndex) {
  setToStorage("currentStep", stepIndex);
}

function getSavedCurrentStep() {
  const saved = getFromStorage("currentStep", 0);
  return typeof saved === "number" && saved >= 0 ? saved : 0;
}

function clearSurveyResults() {
  const keysToRemove = [
    "onboardingSurveyAnswers_1",
    "onboardingSurveyAnswers_2",
    "SurveyAnswersCourseTypes",
    "recommendedCourses",
    "selectedCourses",
  ];

  keysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to remove ${key} from localStorage:`, e);
    }
  });
}

function saveFormData(formData) {
  const existingData = getFromStorage("userData", {});
  const mergedData = { ...existingData, ...formData };
  if (mergedData.password) {
    delete mergedData.password;
  }
  setToStorage("userData", mergedData);
}

function restoreFormData() {
  const savedData = getFromStorage("userData", {});
  const form = document.getElementById("signUpForm");
  if (!form || !savedData) {
    clearPasswordField();
    return;
  }

  clearPasswordField();

  const fields = {
    namePrefix: form.querySelector('select[name="namePrefix"]'),
    firstName: form.querySelector('input[name="firstName"]'),
    lastName: form.querySelector('input[name="lastName"]'),
    dateOfBirth: form.querySelector('input[name="dateOfBirth"]'),
    email: form.querySelector('input[name="email"]'),
    communicationViaEmail: form.querySelector('input[name="communication-via-email"]'),
    newsletterSignUp: form.querySelector('input[name="newsletter-sign-up"]'),
    privacyPolicy: form.querySelector('input[name="privacyPolicy"]'),
  };

  if (fields.namePrefix && savedData.namePrefix) {
    const optionExists = Array.from(fields.namePrefix.options).some(
      opt => opt.value === savedData.namePrefix
    );
    if (optionExists) {
      fields.namePrefix.value = savedData.namePrefix;
    }
  }
  if (fields.firstName && savedData.firstName) {
    fields.firstName.value = savedData.firstName;
  }
  if (fields.lastName && savedData.lastName) {
    fields.lastName.value = savedData.lastName;
  }
  if (fields.dateOfBirth && savedData.dateOfBirth) {
    fields.dateOfBirth.value = savedData.dateOfBirth;
  }
  if (fields.email && savedData.email) {
    fields.email.value = savedData.email;
  }
  if (fields.communicationViaEmail) {
    const shouldBeChecked = savedData.communicationViaEmail !== false;
    fields.communicationViaEmail.checked = shouldBeChecked;
    if (shouldBeChecked) {
      fields.communicationViaEmail.setAttribute("checked", "checked");
      fields.communicationViaEmail.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  if (fields.newsletterSignUp) {
    const shouldBeChecked = savedData.newsletterSignUp === true;
    fields.newsletterSignUp.checked = shouldBeChecked;
    if (shouldBeChecked) {
      fields.newsletterSignUp.setAttribute("checked", "checked");
      fields.newsletterSignUp.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  if (fields.privacyPolicy) {
    const shouldBeChecked = savedData.privacyPolicy === true;
    fields.privacyPolicy.checked = shouldBeChecked;
    if (shouldBeChecked) {
      fields.privacyPolicy.setAttribute("checked", "checked");
      fields.privacyPolicy.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

function clearPasswordField() {
  const form = document.getElementById("signUpForm");
  if (!form) return;

  const passwordField = form.querySelector('input[name="password"]');
  const passwordConfirmField = form.querySelector('input[name="passwordConfirm"]');
  const allPasswordInputs = form.querySelectorAll('input[type="password"]');

  allPasswordInputs.forEach((input) => {
    input.value = "";
    input.autocomplete = "new-password";
    input.setAttribute("data-lpignore", "true");
    input.setAttribute("data-form-type", "other");
    input.setAttribute("autocomplete", "new-password");
  });

  if (passwordField) {
    const savedData = getFromStorage("userData", {});
    if (savedData.password) {
      delete savedData.password;
      setToStorage("userData", savedData);
    }
  }
}

function setupPasswordFieldCleanup() {
  const form = document.getElementById("signUpForm");
  if (!form) return;

  const passwordField = form.querySelector('input[name="password"]');
  const passwordConfirmField = form.querySelector('input[name="passwordConfirm"]');

  if (passwordField && !passwordField._cleanupSetup) {
    passwordField._cleanupSetup = true;
    let userTyping = false;

    passwordField.addEventListener("input", () => {
      userTyping = true;
      const savedData = getFromStorage("userData", {});
      if (savedData.password) {
        delete savedData.password;
        setToStorage("userData", savedData);
      }
    });

    passwordField.addEventListener("keydown", () => {
      userTyping = true;
    });

    const clearIfAutoFilled = () => {
      if (!userTyping && passwordField.value) {
        passwordField.value = "";
        const savedData = getFromStorage("userData", {});
        if (savedData.password) {
          delete savedData.password;
          setToStorage("userData", savedData);
        }
      }
    };

    passwordField.addEventListener("focus", () => {
      userTyping = false;
      setTimeout(clearIfAutoFilled, 100);
    });

    setTimeout(() => {
      if (passwordField.value && document.activeElement !== passwordField) {
        clearIfAutoFilled();
      }
    }, 1500);
  }

  if (passwordConfirmField && !passwordConfirmField._cleanupSetup) {
    passwordConfirmField._cleanupSetup = true;
    
    passwordConfirmField.addEventListener("focus", () => {
      if (passwordConfirmField.value) {
        passwordConfirmField.value = "";
      }
    });
  }
}

function hidePasswordFieldsIfUserExists() {
  const userId = getUserIdSafe();
  if (!userId) return;

  const userData = getFromStorage("userData", {});
  if (userData.password) {
    delete userData.password;
    setToStorage("userData", userData);
  }

  clearPasswordField();

  const form = document.getElementById("signUpForm");
  if (!form) return;

  const passwordField = form.querySelector('input[name="password"]');
  const passwordConfirmField = form.querySelector('input[name="passwordConfirm"]');
  const passwordLabel = passwordField?.closest('.w-form-group') || passwordField?.parentElement;
  const passwordConfirmLabel = passwordConfirmField?.closest('.w-form-group') || passwordConfirmField?.parentElement;

  if (passwordField && passwordLabel) {
    passwordLabel.style.display = "none";
  }
  if (passwordConfirmField && passwordConfirmLabel) {
    passwordConfirmLabel.style.display = "none";
  }
}

function disableFormFieldsIfUserExists() {
  const userId = getUserIdSafe();
  if (!userId) return;

  const form = document.getElementById("signUpForm");
  if (!form) return;

  const fields = [
    form.querySelector('select[name="namePrefix"]'),
    form.querySelector('input[name="firstName"]'),
    form.querySelector('input[name="lastName"]'),
    form.querySelector('input[name="dateOfBirth"]'),
    form.querySelector('input[name="email"]'),
    form.querySelector('input[name="password"]'),
    form.querySelector('input[name="communication-via-email"]'),
    form.querySelector('input[name="newsletter-sign-up"]'),
    form.querySelector('input[name="privacyPolicy"]'),
  ];

  fields.forEach((field) => {
    if (field) {
      field.disabled = true;
    }
  });
}

function resetSignupFormState() {
  const form = document.getElementById("signUpForm");
  if (!form) return;

  const fields = [
    form.querySelector('select[name="namePrefix"]'),
    form.querySelector('input[name="firstName"]'),
    form.querySelector('input[name="lastName"]'),
    form.querySelector('input[name="dateOfBirth"]'),
    form.querySelector('input[name="email"]'),
    form.querySelector('input[name="password"]'),
    form.querySelector('input[name="passwordConfirm"]'),
    form.querySelector('input[name="communication-via-email"]'),
    form.querySelector('input[name="newsletter-sign-up"]'),
    form.querySelector('input[name="privacyPolicy"]'),
  ];

  fields.forEach((field) => {
    if (!field) return;
    field.disabled = false;
    field.classList.remove("error");
    if (field.type === "checkbox") {
      field.checked = false;
    } else {
      field.value = "";
    }
  });

  const passwordField = form.querySelector('input[name="password"]');
  const passwordConfirmField = form.querySelector(
    'input[name="passwordConfirm"]'
  );
  const passwordLabel =
    passwordField?.closest(".w-form-group") || passwordField?.parentElement;
  const passwordConfirmLabel =
    passwordConfirmField?.closest(".w-form-group") ||
    passwordConfirmField?.parentElement;

  if (passwordLabel) passwordLabel.style.display = "";
  if (passwordConfirmLabel) passwordConfirmLabel.style.display = "";

  clearPasswordField();
}

function resetCheckoutView() {
  const productList = document.querySelector("#productList");
  if (productList) productList.innerHTML = "";
  const totalContainer = document.querySelector("#priceTotal");
  if (totalContainer) totalContainer.innerHTML = "";
}

function setupFormAutoSave() {
  const form = document.getElementById("signUpForm");
  if (!form || form._autoSaveSetup) return;
  
  form._autoSaveSetup = true;

  const fields = {
    namePrefix: form.querySelector('select[name="namePrefix"]'),
    firstName: form.querySelector('input[name="firstName"]'),
    lastName: form.querySelector('input[name="lastName"]'),
    dateOfBirth: form.querySelector('input[name="dateOfBirth"]'),
    email: form.querySelector('input[name="email"]'),
    communicationViaEmail: form.querySelector('input[name="communication-via-email"]'),
    newsletterSignUp: form.querySelector('input[name="newsletter-sign-up"]'),
    privacyPolicy: form.querySelector('input[name="privacyPolicy"]'),
  };

  Object.entries(fields).forEach(([key, field]) => {
    if (!field) return;

    if (field.type === "checkbox") {
      field.addEventListener("change", () => {
        saveFormData({ [key]: field.checked });
      });
    } else {
      field.addEventListener("input", () => {
        saveFormData({ [key]: field.value });
      });
      field.addEventListener("change", () => {
        saveFormData({ [key]: field.value });
      });
    }
  });
}
/* -------------------- flow hooks -------------------- */
function onboardingHook({ current, index }) {
  if (index === 0) {
    fetchPricing();
    fetchContraindications();
    fetchCourses();
    fetchOnboardingSurvey();
  } else if (index === 1) {
    populateOnboardingSurveyStep1();
  } else if (index === 2) {
    getStep1Answers();
    populateOnboardingSurveyStep2();
  } else if (index === 3) {
    getStep2Answers();
    recommendCourses();
    populateSummary();
  } else if (index === 4) {
    populateContraindications();
    populateNamePrefix().then(() => {
      setTimeout(() => {
        clearPasswordField();
        restoreFormData();
        setupFormAutoSave();
        setupPasswordFieldCleanup();
        hidePasswordFieldsIfUserExists();
        disableFormFieldsIfUserExists();
      }, 100);
    });
  } else if (index === 5) {
    populateCheckout();
    populateNamePrefix().then(() => {
      setTimeout(() => {
        clearPasswordField();
        restoreFormData();
        
        setTimeout(() => {
          const form = document.getElementById("signUpForm");
          if (form) {
            const savedData = getFromStorage("userData", {});
            const communicationCheckbox = form.querySelector('input[name="communication-via-email"]');
            const privacyCheckbox = form.querySelector('input[name="privacyPolicy"]');
            
            if (communicationCheckbox && savedData.communicationViaEmail !== false) {
              communicationCheckbox.checked = true;
              communicationCheckbox.setAttribute("checked", "checked");
            }
            if (privacyCheckbox && savedData.privacyPolicy === true) {
              privacyCheckbox.checked = true;
              privacyCheckbox.setAttribute("checked", "checked");
            }
          }
        }, 50);
        
        setupFormAutoSave();
        setupPasswordFieldCleanup();
        hidePasswordFieldsIfUserExists();
        disableFormFieldsIfUserExists();
      }, 100);
    });
  }
}

/* -------------------- health providers -------------------- */
let HP_FULL = null;          // Полные данные провайдеров на время жизни вкладки
let HP_FULL_PROMISE = null;  // Один общий промис загрузки полных данных

function getHealthProviderKeysUrl() {
  return `${API}/getConfigData?document=healthInsuranceProviders&view=keys`;
}

// простая экранизация для option-текста
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchHealthProviders() {
  const dropdown = document.querySelector("#healthProviders");
  const disclaimer = document.querySelector(".input_disclaimer");
  if (!dropdown) return;

  dropdown.disabled = true;
  dropdown.innerHTML = `<option value="">${dictionary["select.healthProvider"]} …</option>`;

  try {
    const resKeys = await fetch(getHealthProviderKeysUrl());
    const dataKeys = await resKeys.json();
    const providers = Array.isArray(dataKeys?.data?.keys)
      ? dataKeys.data.keys
      : [];

    populateDropdown(providers, { dropdown, disclaimer });

    HP_FULL_PROMISE = (async () => {
      const resFull = await fetch(getDocumentFromFireBase("healthInsuranceProviders"));
      const dataFull = await resFull.json();
      if (dataFull?.success && dataFull?.data) {
        HP_FULL = dataFull.data;
        setToStorage("healthProviders", HP_FULL);
      }
      return HP_FULL;
    })();

  } catch (e) {
    console.warn("HP keys fetch error:", e);
    try {
      const resFull = await fetch(getDocumentFromFireBase("healthInsuranceProviders"));
      const dataFull = await resFull.json();
      const providers = dataFull?.success ? Object.keys(dataFull.data || {}) : [];
      HP_FULL = dataFull?.success ? dataFull.data : null;
      if (HP_FULL) setToStorage("healthProviders", HP_FULL);
      populateDropdown(providers, { dropdown, disclaimer });
    } catch (e2) {
      dropdown.disabled = false;
      dropdown.innerHTML = `<option value="">${dictionary["select.healthProvider"]}</option>`;
    }
  }
}

function populateDropdown(providers, { dropdown, disclaimer }) {
  const opts = [`<option value="">${dictionary["select.healthProvider"]}</option>`];
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    opts.push(`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`);
  }
  dropdown.innerHTML = opts.join("");
  dropdown.disabled = false;

  const prev = dropdown._hpChangeHandler;
  if (prev) dropdown.removeEventListener("change", prev);

  async function handleDropdownChange(e) {
    const selectedProvider = e.target.value || "";

    if (disclaimer) {
      disclaimer.style.visibility = selectedProvider ? "visible" : "hidden";
    }

    if (!HP_FULL && HP_FULL_PROMISE) {
      try { await HP_FULL_PROMISE; } catch(_) {}
    }
    const hpAll = HP_FULL || getFromStorage("healthProviders", {}) || {};
    const hp = hpAll[selectedProvider];

    const takeoverEl = document.querySelector("#takeover");
    if (takeoverEl) takeoverEl.innerHTML = hp?.takeover || "";

    updateInfoBox(selectedProvider);
  }

  dropdown._hpChangeHandler = handleDropdownChange;
  dropdown.addEventListener("change", handleDropdownChange);

  const saved = getFromStorage("selectedHealthProvider", "");
  if (saved && providers.includes(saved)) {
    dropdown.value = saved;
    (async () => {
      if (!HP_FULL && HP_FULL_PROMISE) { try { await HP_FULL_PROMISE; } catch(_) {} }
      const hp = (HP_FULL || getFromStorage("healthProviders", {}))[saved] || {};
      const takeoverEl = document.querySelector("#takeover");
      if (takeoverEl) takeoverEl.innerHTML = hp?.takeover || "";
      if (disclaimer) disclaimer.style.visibility = "visible";
      updateInfoBox(saved);
    })();
  } else {
    if (disclaimer) disclaimer.style.visibility = "hidden";
  }
}

/* -------------------- pricing & content -------------------- */
async function fetchPricing() {
  try {
    const res = await fetch(getDocumentFromFireBase("pricing"));
    const data = await res.json();
    if (data.success && data.data) setToStorage("pricing", data.data);
  } catch (error) {
    console.error(error);
  }
}

async function fetchContraindications() {
  try {
    const res = await fetch(getWebflowStory("health-contraindications"));
    const data = await res.json();
    const healthContraindications = data.story?.content?.contraindications;
    if (healthContraindications)
      setToStorage("contraindications", healthContraindications);
  } catch (error) {
    console.error(error);
  }
}

function getFilteredContraindications() {
  const recommendedCourses = getFromStorage("recommendedCourses", []);
  const contraindications = getFromStorage("contraindications", []);
  return contraindications.filter((c) =>
    recommendedCourses.includes(c.course_slug)
  );
}

async function fetchCourses() {
  const res = await fetch(getDocumentFromFireBase("courses"));
  const data = await res.json();
  if (data.success && data.data["courses-info"].length) {
    setToStorage("courses", data.data["courses-info"]);
  }
  return data.data["courses-info"];
}

async function fetchOnboardingSurvey() {
  const res = await fetch(getWebflowStory("onboarding-survey"));
  const data = await res.json();
  const onboardingSurvey = data?.story?.content?.onboarding_survey_steps;
  if (onboardingSurvey?.length)
    setToStorage("onboardingSurvey", onboardingSurvey);
  return onboardingSurvey;
}

/* -------------------- onboarding UI -------------------- */
async function populateOnboardingSurveyStep1() {
  const onboardingSurvey = getFromStorage("onboardingSurvey", [])?.[0]?.answers;
  if (onboardingSurvey?.length) {
    const container = document.querySelector("#coursesContainer");
    container.innerHTML = "";
    onboardingSurvey.forEach((data) => {
      const item = renderCourseItem(
        data.id,
        data.type,
        data.text,
        data.image_cover.filename
      );
      container.appendChild(item);
    });
  }
}

function renderCourseItem(id, value, text, imgSrc) {
  const template = document.createElement("template");
  template.innerHTML = `<label class="w-checkbox form_card_select">
    <div class="card_form_img_contain">
      <img src="${imgSrc}" loading="lazy" sizes="100vw" alt="" class="card_select_img">
    </div>
    <input type="checkbox" data-id="${id}" name="step1[]" data-name="step1[]" data-value="${value}" class="w-checkbox-input card_select_checkbox">
    <span class="card_select_label w-form-label"><br></span>
    <div class="card_select_content u-hflex-left-top u-gap-3">
      <div class="form_checkbox_visible u-hflex-center-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 12 10" fill="none" class="checkbox_icon">
          <path d="M4.16667 9.03341L0.5 5.36675L1.78333 4.08342L4.16667 6.46675L10.2167 0.416748L11.5 1.70008L4.16667 9.03341Z" fill="currentColor"></path>
        </svg>
      </div>
      <div class="card_select_text">${text}</div>
    </div>
  </label>`;
  return template.content.firstElementChild;
}

function getStep1Answers() {
  const selectedCheckboxes = document.querySelectorAll(
    "#coursesContainer .card_select_checkbox:checked"
  );
  const answeredIds = Array.from(selectedCheckboxes).map((checkbox) =>
    checkbox.getAttribute("data-id")
  );
  const onboardingSurvey = getFromStorage("onboardingSurvey", [])?.[0]?.answers;
  setToStorage(
    "onboardingSurveyAnswers_1",
    answeredIds.map((id) => ({
      id,
      type: onboardingSurvey.find((item) => item.id === id)?.type,
    }))
  );
}

function renderOnboardingSurveyItem(id, type, text) {
  const template = document.createElement("template");
  template.innerHTML = `
    <label class="custom-checkbox">
      <input type="checkbox" id="${id}" name="step2[]" data-value="${type}" class="custom-checkbox-input">
      <span class="custom-checkbox-label">${text}</span>
    </label>`;
  return template.content.firstElementChild;
}

async function populateOnboardingSurveyStep2() {
  const onboardingSurvey = getFromStorage("onboardingSurvey", [])?.[1]?.answers;
  if (onboardingSurvey?.length) {
    const container = document.querySelector("#onboardingSurvey");
    container.innerHTML = "";
    onboardingSurvey.forEach((data) => {
      const item = renderOnboardingSurveyItem(data.id, data.type, data.text);
      container.appendChild(item);
    });
  }
}

function getStep2Answers() {
  const selectedCheckboxes = document.querySelectorAll(
    ".custom-checkbox-input:checked"
  );
  const surveyAnswers = Array.from(selectedCheckboxes).map(
    (checkbox) => checkbox.id
  );
  const onboardingSurvey = getFromStorage("onboardingSurvey", [])?.[1]?.answers;
  setToStorage(
    "onboardingSurveyAnswers_2",
    surveyAnswers.map((id) => ({
      id,
      type: onboardingSurvey.find((item) => item.id === id)?.type,
    }))
  );
}

function renderCardResult(imageSrc, title, text, color, slug, checked = false) {
  const template = document.createElement("template");
  template.innerHTML = `
    <label lang="de" class="w-checkbox card_result">
      <div class="card_form_img_contain">
        <img sizes="100vw" src="${imageSrc}" loading="lazy" alt="" class="card_select_img">
      </div>
      <input type="checkbox" name="checkout" data-name="checkout" data-value="${slug}" class="w-checkbox-input card_result_checkbox" ${
    checked ? "checked" : ""
  }>
      <span class="card_select_label w-form-label"></span>
      <div class="card_result_content u-vflex-stretch-top u-gap-2">
        <div class="card_result_h_wrap u-hflex-between-top u-gap-4">
          <h4 style="max-width: 210px; hyphens: auto;">${title}</h4>
          <div class="icon_small is-checkmark" style="background-color:${
            checked ? color : DEFAULT_CHECKMARK_COLOR
          }">
            <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 22 22" fill="none">
              <path d="M9.16667 15.0334L5.5 11.3667L6.78333 10.0834L9.16667 12.4667L15.2167 6.41675L16.5 7.70008L9.16667 15.0334Z" fill="currentColor"></path>
            </svg>
          </div>
        </div>
        <div>${text}</div>
      </div>
    </label>`;
  const element = template.content.firstElementChild;
  const checkbox = element.querySelector(".card_result_checkbox");
  const checkmark = element.querySelector(".icon_small.is-checkmark");
  checkmark.style.backgroundColor = checked ? color : DEFAULT_CHECKMARK_COLOR;
  checkbox.addEventListener("change", function () {
    checkmark.style.backgroundColor = this.checked
      ? color
      : DEFAULT_CHECKMARK_COLOR;
  });
  return element;
}

function recommendCourses() {
  const answers_1 = getFromStorage("onboardingSurveyAnswers_1", []);
  const answers_2 = getFromStorage("onboardingSurveyAnswers_2", []);
  const courses = getFromStorage("courses", []);
  const allAnswerTypes = [...answers_1, ...answers_2].map((a) => a.type);
  const typeCounts = allAnswerTypes.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  setToStorage("SurveyAnswersCourseTypes", typeCounts);

  const uniqueTypes = Object.keys(typeCounts);
  if (uniqueTypes.length === 1) {
    const selectedType = uniqueTypes[0];
    const additional = {
      STRESS: "FITNESS",
      FITNESS: "NUTRITION",
      NUTRITION: "STRESS",
    }[selectedType];
    if (additional) typeCounts[additional] = 1;
  }

  const recommendedTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type]) => type);

  const recommendedCourses = courses
    .filter((c) => recommendedTypes.includes(c.slug))
    .map((c) => c.slug);
  setToStorage("recommendedCourses", recommendedCourses);
  setToStorage("selectedCourses", recommendedCourses);
  return recommendedCourses;
}

function fillSummaryData() {
  setToStorage("trial", false);
  const takeoverSummary = document.querySelector("#takeoverSummary");
  const selectedHealthProvider = getFromStorage("selectedHealthProvider", "");
  const healthProviders = getFromStorage("healthProviders", {});
  if (takeoverSummary && selectedHealthProvider)
    takeoverSummary.innerHTML =
      healthProviders[selectedHealthProvider].takeover;

  const price = document.querySelector("#price");
  if (price) price.innerHTML = calculateTotalPrice() + CURRENCY;

  const coursesCountElement = document.querySelector(".courses-info-duration");
  const overviewCoursesCountElement = document.querySelector(
    ".course-duration-overview"
  );
  const cc = getFromStorage("selectedCourses", []).length;
  if (coursesCountElement && overviewCoursesCountElement) {
    if (cc === 1) {
      coursesCountElement.innerHTML = "Für 1 Kurs – 12 Monate Zugang";
      overviewCoursesCountElement.innerHTML = "12 Monate Zugang";
    } else if (cc === 2) {
      coursesCountElement.innerHTML = "Für 2 Kurse – 18 Monate Zugang";
      overviewCoursesCountElement.innerHTML = "18 Monate Zugang";
    } else {
      coursesCountElement.innerHTML = "Bitte wählen Sie mindestens 1 Kurs";
      overviewCoursesCountElement.innerHTML = "12 Monate Zugang";
    }
  }

  const subscriptionLengthElement = document.querySelector(
    "#subscriptionLength"
  );
  if (subscriptionLengthElement) {
    subscriptionLengthElement.innerHTML =
      getFromStorage("selectedCourses", []).length === 1 ? "12" : "18";
  }

  const explainerMonthDisplayer = document.querySelector(
    "#explainer-month-displayer"
  );
  if (explainerMonthDisplayer) {
    const selectedCoursesCount = getFromStorage("selectedCourses", []).length;
    explainerMonthDisplayer.textContent = selectedCoursesCount === 2 ? "18" : "12";
  }

  const trialButton = document.querySelector("#button_trial");
  if (trialButton) {
    trialButton.addEventListener("click", () => setToStorage("trial", true));
  }
}

function populateContraindications() {
  const container = document.querySelector(".dropdown_padding");
  const filteredCourses = getFromStorage("courses", []);
  const selectedCourses = getFromStorage("selectedCourses", []);
  const contraindications = getFromStorage("contraindications", []);
  filteredCourses.forEach((course) => {
    if (selectedCourses.includes(course.slug)) {
      const item = renderContraindicationItem(
        course.slug,
        course.name,
        contraindications.filter((c) => c.course_slug === course.slug)
      );
      container.appendChild(item);
    }
  });
}

function onCourseSelected() {
  const selectedCheckboxes = document.querySelectorAll(
    ".card_result_checkbox:checked"
  );
  const button = getSiblingButtonBySelector(
    "#button_purchase_onb_recommendation",
    "button"
  );
  const coursesSlugs = Array.from(selectedCheckboxes).map((checkbox) =>
    checkbox.getAttribute("data-value")
  );
  setToStorage("selectedCourses", coursesSlugs);
  if (button) {
    const btn = button.querySelector(".g_clickable_btn");
    if (coursesSlugs.length === 0) {
      button.classList.add("disabled");
      if (btn) btn.disabled = true;
    } else {
      button.classList.remove("disabled");
      if (btn) btn.disabled = false;
    }
  }
  fillSummaryData();
}

function populateSummary() {
  const container = document.querySelector("#summary");
  const recommendedCourses = getFromStorage("recommendedCourses", []);
  const summaryWrap = container.querySelector(".summary_wrap");
  container.innerHTML = "";
  if (summaryWrap) container.appendChild(summaryWrap);

  recommendedCourses
    .slice()
    .reverse()
    .forEach((course) => {
      const courseData = getFromStorage("courses", [])?.find(
        (item) => item.slug === course
      );
      if (courseData) {
        container.prepend(
          renderCardResult(
            courseData.course_cover,
            courseData.name,
            courseData.recommendation_description,
            courseData.course_color,
            courseData.slug,
            true
          )
        );
      }
    });

  container.addEventListener("change", (event) => {
    if (event.target.classList.contains("card_result_checkbox"))
      onCourseSelected();
  });
  onCourseSelected();
}

function renderContraindicationItem(slug, name, contraindications) {
  const template = document.createElement("template");
  template.innerHTML = `
    <div class="dropdown_content">
      <div class="program_name">Programm: ${name}</div>
      <ul role="list" class="program_list">
        ${contraindications
          .map(
            (c) => `<li class="program_list_item">${c.contraindication}</li>`
          )
          .join("")}
      </ul>
    </div>`;
  return template.content.firstElementChild;
}

/* -------------------- checkout -------------------- */
function calculateTotalPrice() {
  const pricing = getFromStorage("pricing", {});
  const selectedCourses = getFromStorage("selectedCourses", []);
  const pricePerCourse = Number(pricing.programPrice) || 0;
  return pricePerCourse * selectedCourses.length;
}
function calculateDiscountPercentage() {
  return 0;
}

function populateCheckout() {
  const container = document.querySelector("#productList");
  const filteredCourses = getFromStorage("courses", []);
  const totalContainer = document.querySelector("#priceTotal");
  const selectedCourses = getFromStorage("selectedCourses", []);
  const pricing = getFromStorage("pricing", {});
  const pricePerCourse = Number(pricing.programPrice) || 0;

  if (getFromStorage("trial", false)) {
    const totalWrap = document.querySelector(".price_total");
    if (totalWrap) totalWrap.innerHTML = "";
    const buttons = Array.from(
      document.querySelectorAll(".btn_main_text")
    ).filter((btn) => btn.textContent === "Jetzt kaufen");
    buttons.forEach(
      (button) => (button.innerHTML = "Kurseinheit ausprobieren")
    );
    return;
  }

  filteredCourses.forEach((course) => {
    if (selectedCourses.includes(course.slug)) {
      const item = renderCheckoutItem(course.name, "", "", pricePerCourse);
      container.appendChild(item);
    }
  });
  if (totalContainer)
    totalContainer.innerHTML = calculateTotalPrice().toFixed(2) + CURRENCY;
}

function renderCheckoutItem(title, badgeText, priceOld, priceNew) {
  const wrapper = document.createElement("div");
  wrapper.className = "card_product";
  wrapper.innerHTML = `
    <div class="card_product_content u-vflex-stretch-top u-gap-4">
      <div class="card_product_top">
        <div class="product_name">${title}</div>
        <div class="card_product_price">
          <div class="price_text_new">${priceNew}€</div>
        </div>
      </div>
    </div>`;
  return wrapper;
}

function renderCheckoutCourseItem(
  imageSrc,
  title,
  description,
  price,
  badgeText,
  badgeColor
) {
  const template = document.createElement("template");
  template.innerHTML = `
    <div class="card_product">
      <img src="${imageSrc}" loading="lazy" sizes="100vw" alt="" class="card_product_img">
      <div class="card_product_content u-vflex-stretch-top u-gap-4">
        <div class="card_product_top">
          <h4 class="product_name">${title}</h4>
          <div class="card_product_price"><div class="price_text_new">${price}${CURRENCY}</div></div>
        </div>
        <div class="product_description">${description}</div>
        ${
          badgeText
            ? `<div class="badge is-border u-align-self-start">
                 <div class="badge_text_small" style="color:${badgeColor}">${badgeText}</div>
               </div>`
            : ""
        }
      </div>
    </div>`;
  return template.content.firstElementChild;
}
/* -------------------- email verification flow -------------------- */
async function apiIsEmailVerified(userId) {
  try {
    const res = await fetch(getIsEmailVerifiedUrl(userId), { method: "GET" });
    const data = await res.json();
    if (!res.ok || !data?.success)
      throw new Error(data?.message || "Check failed");
    return !!data.emailVerified;
  } catch (e) {
    console.error("is-email-verified error:", e);
    return false;
  }
}

async function apiSendVerifyEmail(userId) {
  try {
    const res = await fetch(getVerifyEmailUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success)
      throw new Error(data?.message || "Send failed");
    return true;
  } catch (e) {
    console.error("verify-email error:", e);
    return false;
  }
}

/* ---------- modal (create/show/hide) ---------- */

let EVM_INTERVAL = null;

function ensureEmailVerifyModalExists() {
  let modal = document.getElementById("email_verify_modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "email_verify_modal";
  modal.innerHTML = `
    <div class="evm-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;z-index:9998;"></div>
    <div class="evm-dialog" style="position:fixed;inset:0;display:none;z-index:9999;align-items:center;justify-content:center;">
      <div class="evm-card" style="max-width:600px;width:92%;background:#fff;border-radius:16px;padding:24px 24px 18px;box-shadow:0 16px 40px rgba(0,0,0,.2);">
        <h2 style="margin:0 0 14px 0;font-size:30px;line-height:1.2;color:#13223b;">E-Mail bestätigen</h2>
        <p id="evm_text" style="margin:0 0 12px 0;line-height:1.55;color:#1f2937;font-size:16px;">
          Bitte klicken Sie auf <strong>„Bestätigungslink senden“</strong>, öffnen Sie den Link in Ihrer E-Mail
          und kehren Sie anschließend in diese Browser-Registerkarte zurück. Danach klicken Sie auf
          <strong>„Bestätigung prüfen“</strong>.
        </p>

        <div id="evm_error" style="display:none;margin:10px 0 6px;color:#b91c1c;font-size:14px;"></div>
        <div id="evm_success" style="display:none;margin:10px 0 6px;color:#166534;font-size:14px;"></div>

        <div id="evm_actions_initial" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
          <button id="evm_send" style="padding:10px 14px;border-radius:10px;border:1px solid #111827;background:#111827;color:#fff;cursor:pointer;">
            Bestätigungslink senden
          </button>
          <button id="evm_cancel" style="padding:10px 14px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#111827;cursor:pointer;">
            Abbrechen
          </button>
        </div>

        <div id="evm_actions_after_send" style="display:none;gap:10px;flex-wrap:wrap;margin-top:12px;">
          <button id="evm_resend" style="padding:10px 14px;border-radius:10px;border:1px solid #111827;background:#111827;color:#fff;cursor:pointer;">
            Nochmals senden
          </button>
          <button id="evm_check" style="padding:10px 14px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#111827;cursor:pointer;">
            Bestätigung prüfen
          </button>
          <button id="evm_close" style="margin-left:auto;padding:10px 14px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#111827;cursor:pointer;">
            Schließen
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function showEmailVerifyModal() {
  const m = ensureEmailVerifyModalExists();
  m.querySelector(".evm-backdrop").style.display = "block";
  m.querySelector(".evm-dialog").style.display = "flex";
}

function hideEmailVerifyModal() {
  const m = document.getElementById("email_verify_modal");
  if (!m) return;
  m.querySelector(".evm-backdrop").style.display = "none";
  m.querySelector(".evm-dialog").style.display = "none";

  m.querySelector("#evm_error").style.display = "none";
  m.querySelector("#evm_error").textContent = "";
  m.querySelector("#evm_success").style.display = "none";
  m.querySelector("#evm_success").textContent = "";
  m.querySelector("#evm_actions_initial").style.display = "flex";
  m.querySelector("#evm_actions_after_send").style.display = "none";

  if (EVM_INTERVAL) {
    clearInterval(EVM_INTERVAL);
    EVM_INTERVAL = null;
  }
}

/* ---------- countdown helper ---------- */

function startResendCountdown(btn, seconds = 60) {
  const baseLabel = "Nochmals senden";
  const setLabel = (s) => (btn.textContent = `${baseLabel} (${s})`);

  btn.disabled = true;
  setLabel(seconds);

  if (EVM_INTERVAL) clearInterval(EVM_INTERVAL);
  EVM_INTERVAL = setInterval(() => {
    seconds -= 1;
    if (seconds <= 0) {
      clearInterval(EVM_INTERVAL);
      EVM_INTERVAL = null;
      btn.disabled = false;
      btn.textContent = baseLabel;
      return;
    }
    setLabel(seconds);
  }, 1000);
}

/* ---------- wire modal logic ---------- */

function wireEmailVerifyModal({ userId, onVerified }) {
  const m = ensureEmailVerifyModalExists();

  ["evm_send", "evm_cancel", "evm_resend", "evm_check", "evm_close"].forEach(
    (id) => {
      const el = m.querySelector(`#${id}`);
      if (el) {
        const clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);
      }
    }
  );

  const btnSend = m.querySelector("#evm_send");
  const btnCancel = m.querySelector("#evm_cancel");
  const btnResend = m.querySelector("#evm_resend");
  const btnCheck = m.querySelector("#evm_check");
  const btnClose = m.querySelector("#evm_close");

  const errBox = m.querySelector("#evm_error");
  const okBox = m.querySelector("#evm_success");
  const aInit = m.querySelector("#evm_actions_initial");
  const aAfter = m.querySelector("#evm_actions_after_send");

  const showErr = (t) => {
    errBox.textContent = t || "";
    errBox.style.display = t ? "block" : "none";
    if (t) {
      okBox.style.display = "none";
      okBox.textContent = "";
    }
  };
  const showOk = (t) => {
    okBox.textContent = t || "";
    okBox.style.display = t ? "block" : "none";
    if (t) {
      errBox.style.display = "none";
      errBox.textContent = "";
    }
  };

  btnSend.addEventListener("click", async () => {
    btnSend.disabled = true;
    showErr("");
    showOk("");

    const ok = await apiSendVerifyEmail(userId);
    btnSend.disabled = false;

    if (!ok) {
      showErr("Fehler beim Senden des Bestätigungslinks.");
      return;
    }

    aInit.style.display = "none";
    aAfter.style.display = "flex";
    showOk(
      "Link gesendet. Öffnen Sie die E-Mail und klicken Sie auf den Link."
    );
    startResendCountdown(btnResend, 60);
  });

  btnResend.addEventListener("click", async () => {
    if (btnResend.disabled) return;

    btnResend.disabled = true;
    showErr("");
    showOk("");

    const ok = await apiSendVerifyEmail(userId);
    if (!ok) {
      btnResend.disabled = false;
      showErr("Fehler beim Senden des Bestätigungslinks.");
      return;
    }

    showOk("Link erneut gesendet.");
    startResendCountdown(btnResend, 60);
  });

  btnCheck.addEventListener("click", async () => {
    btnCheck.disabled = true;
    showErr("");
    showOk("Prüfe Bestätigung…");

    const verified = await apiIsEmailVerified(userId);
    btnCheck.disabled = false;

    if (verified) {
      showOk("E-Mail wurde bestätigt. Es geht weiter zur Zahlung …");
      hideEmailVerifyModal();
      if (typeof onVerified === "function") onVerified();
    } else {
      showErr(
        "E-Mail ist noch nicht bestätigt. Bitte klicken Sie auf den Link in Ihrer E-Mail und versuchen Sie es erneut."
      );
    }
  });

  btnCancel.addEventListener("click", () => {
    hideEmailVerifyModal();
    if (typeof onCancel === "function") {
      onCancel();
    }
  });
  btnClose.addEventListener("click", () => {
    hideEmailVerifyModal();
    if (typeof onCancel === "function") {
      onCancel();
    }
  });
}

/* ---------- entry point before payment ---------- */

function getUserIdSafe() {
  const fromCreate = getFromStorage("createUserResponse", null);
  if (
    fromCreate &&
    typeof fromCreate.userId === "string" &&
    fromCreate.userId.length > 0
  ) {
    return fromCreate.userId;
  }
  const fromKey = getFromStorage("userId", null);
  if (typeof fromKey === "string" && fromKey.length > 0) return fromKey;
  return null;
}

async function ensureEmailVerifiedThenPay(amount, showLoader = false) {
  const userId = getUserIdSafe();
  if (!userId) {
    console.error("No userId found for email verification.");
    const errDiv = document.querySelector("#error_message_step5");
    if (errDiv) {
      errDiv.style.display = "block";
      errDiv.textContent = "Unbekannter Fehler: Benutzer nicht gefunden.";
    }
    setSubmitButtonLoading(false);
    if (showLoader) hideFullscreenLoader();
    return;
  }

  try {
    const verified = await apiIsEmailVerified(userId);
    if (verified) {
      await doPayment(amount, showLoader);
      return;
    }

    wireEmailVerifyModal({
      userId,
      onVerified: () => {
        doPayment(amount, showLoader);
      },
      onCancel: () => {
        setSubmitButtonLoading(false);
        if (showLoader) hideFullscreenLoader();
      }
    });
    showEmailVerifyModal();
  } catch (error) {
    console.error("Email verification error:", error);
    setSubmitButtonLoading(false);
    if (showLoader) hideFullscreenLoader();
    throw error;
  }
}

async function ensureEmailVerifiedThenCompleteTrial(showLoader = false) {
  const userId = getUserIdSafe();
  if (!userId) {
    console.error("No userId found for email verification.");
    const errDiv = document.querySelector("#error_message_step5");
    if (errDiv) {
      errDiv.style.display = "block";
      errDiv.textContent = "Unbekannter Fehler: Benutzer nicht gefunden.";
    }
    setSubmitButtonLoading(false);
    if (showLoader) hideFullscreenLoader();
    return;
  }

  try {
    const verified = await apiIsEmailVerified(userId);
    if (verified) {
      await completeOnboarding(userId, true);
      if (showLoader) hideFullscreenLoader();
      clearLocalStorageAfterPayment();
      window.location.href = window.location.href.replace(
        "onboarding",
        "vielen-dank"
      );
      return;
    }

    wireEmailVerifyModal({
      userId,
      onVerified: async () => {
        await completeOnboarding(userId, true);
        if (showLoader) hideFullscreenLoader();
        clearLocalStorageAfterPayment();
        window.location.href = window.location.href.replace(
          "onboarding",
          "vielen-dank"
        );
      },
      onCancel: () => {
        setSubmitButtonLoading(false);
        if (showLoader) hideFullscreenLoader();
      }
    });
    showEmailVerifyModal();
  } catch (error) {
    console.error("Email verification error:", error);
    setSubmitButtonLoading(false);
    if (showLoader) hideFullscreenLoader();
    throw error;
  }
}
/* -------------------- stripe -------------------- */
async function initializeStripe() {
  if (typeof Stripe === "undefined") {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    document.head.appendChild(script);
    await new Promise((resolve) => (script.onload = resolve));
  }
  stripe = Stripe(PUBLISHABLE_KEY, { locale: "de" });
  return stripe;
}

async function handlePurchaseAndInvoice(paymentIntentId, amount, userId) {
  try {
    const response = await fetch(`${API_URL}/handlePurchaseAndInvoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId, amount, userId }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Failed to generate invoice");
    if (data.success && data.pdfUrl) {
      setToStorage("invoiceUrl", data.pdfUrl);
      return data;
    } else {
      throw new Error("Invalid response from invoice service");
    }
  } catch (error) {
    console.error("Error generating invoice:", error);
    return null;
  }
}

async function sendWelcomeEmail(userId, programSlugs) {
  try {
    const response = await fetch(`${API_URL}/sendWebWelcomeEmail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, programSlugs }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Failed to send welcome email");
    return data;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return null;
  }
}

async function completeOnboarding(userId, isTrial = false) {
  try {
    const response = await fetch(`${API}/complete-onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, isTrial }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Failed to complete onboarding");
    return data;
  } catch (error) {
    console.error("Error completing onboarding:", error);
    return null;
  }
}

async function doPayment(amount, showLoader = false) {
  try {
    setSubmitButtonLoading(true);
    const errorDiv = document.querySelector("#error_message_payment");

    if (!stripe) await initializeStripe();

    const userData = getFromStorage("userData", {});
    const body = {
      amount: amount * 100,
      userId: getFromStorage("createUserResponse", {}).userId,
      courseSlugs: getFromStorage("selectedCourses", []),
    };

    setToStorage("paymentIntentPayload", body);
    const response = await fetch(
      "https://europe-west3-preneo-production.cloudfunctions.net/createPaymentIntent",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Failed to create payment intent");

    setToStorage("paymentIntentResponse", data);
    const clientSecret = data.paymentIntent;
    if (!clientSecret)
      throw new Error("No client secret received from payment intent");

    const elements = stripe.elements({
      clientSecret,
      locale: "de",
      appearance: { theme: "stripe", variables: { colorPrimary: "#5469d4" } },
      loader: "auto",
    });

    const mountEl = document.getElementById("payment_element");
    if (mountEl) mountEl.innerHTML = "";

    const paymentElement = elements.create("payment");

    if (showLoader) hideFullscreenLoader();

    const popupWrap = document.querySelector("#payment_popup_wrapper");
    popupWrap.classList.add("active");
    popupWrap.style.display = "flex";

    const submitButton = getSiblingButtonBySelector(
      "#submit_payment",
      "button"
    );
    const submitButtonText = getSiblingButtonBySelector(
      "#submit_payment",
      ".btn_main_text"
    );

    paymentElement.mount("#payment_element");

    const paymentGatewayContainer = document.querySelector(
      ".payment_gateway_contain"
    );
    let closePaymentLink = document.getElementById("close_payment_window");
    if (!closePaymentLink && paymentGatewayContainer) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <div style="text-align: center; margin-top: 20px;">
          <a href="#" id="close_payment_window" style="text-decoration: underline; color: #666; font-size: 14px; cursor: pointer;">
            ${dictionary["button.closePayment"]}
          </a>
        </div>`;
      paymentGatewayContainer.appendChild(wrapper);
      closePaymentLink = wrapper.querySelector("#close_payment_window");
    }
    if (closePaymentLink) {
      closePaymentLink.onclick = (e) => {
        e.preventDefault();
        popupWrap.classList.remove("active");
        popupWrap.style.display = "none";
        setSubmitButtonLoading(false);
      };
    }

    submitButton.addEventListener(
      "click",
      async (event) => {
        if (submitButtonText)
          submitButtonText.textContent = dictionary["payment.processing"];
        event.preventDefault();
        submitButton.disabled = true;

        try {
          const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            redirect: "if_required",
            confirmParams: {
              return_url: window.location.href.replace(
                "onboarding",
                "vielen-dank"
              ),
              payment_method_data: {
                billing_details: {
                  name: `${userData.firstName} ${userData.lastName}`,
                  email: userData.email,
                  address: { country: "DE" },
                },
              },
            },
          });

          if (error) {
            console.error("Payment failed:", error);
            errorDiv.style.display = "block";
            errorDiv.textContent = error.message;
          } else if (paymentIntent && paymentIntent.status === "succeeded") {
            setToStorage("paymentSuccess", {
              paymentIntentId: paymentIntent.id,
              amount: amount,
              timestamp: new Date().toISOString(),
            });

            const userId = getFromStorage("createUserResponse", {}).userId;
            const selectedCourses = getFromStorage("selectedCourses", []);
            const programSlugs = selectedCourses.map((course) =>
              course.toUpperCase()
            );

            const purchaseBtn =
              document
                .querySelector("#registerFormSubmitButton")
                ?.closest("button") ||
              document.querySelector("[data-btn-submit]") ||
              document.querySelector("button:has(.btn_main_text)");
            if (purchaseBtn) {
              purchaseBtn.disabled = true;
              purchaseBtn.classList.add("disabled");
              purchaseBtn.setAttribute("aria-disabled", "true");
            }
            console.log("functions started");
            await handlePurchaseAndInvoice(paymentIntent.id, amount, userId);
            await sendWelcomeEmail(userId, programSlugs);
            await completeOnboarding(userId);
            console.log("functions completed");
            if (showLoader) hideFullscreenLoader();
            clearLocalStorageAfterPayment();
            window.location.href = window.location.href.replace(
              "onboarding",
              "vielen-dank"
            );
          } else {
            errorDiv.style.display = "block";
            errorDiv.textContent = dictionary["error.paymentIncomplete"];
          }
        } catch (error) {
          console.error("Payment error:", error);
          errorDiv.style.display = "block";
          errorDiv.textContent = error?.message ?? error.toString();
        } finally {
          if (registerButtonText)
            registerButtonText.textContent = dictionary["payment.payNow"];
          if (submitButtonText)
            submitButtonText.textContent = dictionary["payment.payNow"];
          submitButton.disabled = false;
        }
      },
      { once: true }
    );
  } catch (error) {
    console.error(dictionary["error.payment"], error);
    setSubmitButtonLoading(false);
    if (showLoader) hideFullscreenLoader();
    throw error;
  }
}

/* -------------------- user creation -------------------- */
async function createUser() {
  try {
    const errorDiv = document.querySelector("#error_message_step5");
    errorDiv.style.display = "none";
    const userData = getFromStorage("userData", {});
    const userId = getUserIdSafe();
    const selectedCourses = getFromStorage("selectedCourses", []);
    const recommendedCourses = getFromStorage("recommendedCourses", []);
    const selectedHealthProvider = getFromStorage("selectedHealthProvider", "");
    const healthProvidersFromStorage = getFromStorage("healthProviders", {});
    const onboardingSurveyAnswers_1 = getFromStorage(
      "onboardingSurveyAnswers_1",
      []
    );
    const onboardingSurveyAnswers_2 = getFromStorage(
      "onboardingSurveyAnswers_2",
      []
    );

    const paidCourses = selectedCourses.map((course) => {
      const validTill = new Date();
      validTill.setFullYear(validTill.getFullYear() + 1);
      return {
        course: course.toUpperCase(),
        status: "valid",
        validTill: validTill.toISOString().split("T")[0],
      };
    });

    const allHealthProviders =
      (healthProvidersFromStorage &&
        Object.keys(healthProvidersFromStorage).length > 0 &&
        healthProvidersFromStorage) ||
      HP_FULL ||
      {};
    const healthProviderData = allHealthProviders[selectedHealthProvider] || {};
    const hasContraindications = getFilteredContraindications().length > 0;

    const payload = {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      dateOfBirth: userData.dateOfBirth,
      namePrefix: userData.namePrefix,
      newsletterSignUp: userData.newsletterSignUp || false,
      hasPreconditions: hasContraindications,
      healthProvider: {
        maxCoursePrice: healthProviderData?.maxCoursePrice || "",
        name: selectedHealthProvider,
        numberOfCourses: recommendedCourses.length.toString(),
        takeover: healthProviderData?.takeover || "",
      },
      selectedCourses: selectedCourses.map((course) => course.toUpperCase()),
      onboarding: {
        answers: {
          step1: onboardingSurveyAnswers_1.map((item) => item.type),
          step2: onboardingSurveyAnswers_2.map((item) => item.type),
        },
      },
    };

    if (!userId && userData.password) {
      payload.password = userData.password;
    }

    setToStorage("createUserPayload", payload);

    const response = await fetch(getCreateUserBaseUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.success === false) {
      if (isEmailAlreadyInUse(data)) {
        const savedUserId = getFromStorage("userId", null);
        if (savedUserId) {
          setToStorage("createUserResponse", {
            userId: savedUserId,
            success: true,
          });
          setTimeout(() => {
            disableFormFieldsIfUserExists();
            hidePasswordFieldsIfUserExists();
          }, 100);
          return { userId: savedUserId, success: true, skippedCreation: true };
        }
        errorDiv.style.display = "block";
        errorDiv.textContent = dictionary["error.userExistsNoLocal"];
        throw new Error(dictionary["error.userExistsNoLocal"]);
      }

      errorDiv.style.display = "block";
      errorDiv.textContent = `${data.message || ""} ${data.error || ""}`.trim();
      throw new Error(data.message || data.error || "Failed to create user");
    }

    if (!response.ok || !data.success)
      throw new Error(data.message || "Failed to create user");

    setToStorage("createUserResponse", data);
    setToStorage("userId", data.userId);

    setTimeout(() => {
      disableFormFieldsIfUserExists();
      hidePasswordFieldsIfUserExists();
    }, 100);

    if (!response.ok) throw new Error(data.message || "Failed to create user");
    return data;
  } catch (error) {
    setToStorage("createUserResponse", error);
    console.error("Error creating user:", error);
    throw error;
  }
}

async function populateNamePrefix() {
  const namePrefixSelect = document.querySelector('select[name="namePrefix"]');
  if (!namePrefixSelect) return Promise.resolve();
  
  const savedValue = getFromStorage("userData", {})?.namePrefix || "";
  
  const response = await fetch(getNamePrefixes());
  const data = await response.json();
  const prefixes = data.data;

  while (namePrefixSelect.options.length > 1) {
    namePrefixSelect.remove(1);
  }

  Object.entries(prefixes).forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    namePrefixSelect.appendChild(option);
  });
  
  if (savedValue && prefixes[savedValue]) {
    namePrefixSelect.value = savedValue;
  }
  
  return Promise.resolve();
}

/* -------------------- DOMContentLoaded -------------------- */
document.addEventListener("DOMContentLoaded", function () {
  const steps = document.querySelectorAll(
    ".form_step_wrap .form_step, .form_step_popup"
  );
  const prevBtns = document.querySelectorAll("[data-btn-prev]");
  const nextBtns = [
    ...document.querySelectorAll("[data-btn-next]"),
    document.querySelector("#button_trial"),
  ];
  const submitBtn = document.querySelector("[data-btn-submit]");
  const errorMessageStep1 = document.getElementById("error_message_step1");
  const errorMessageStep2 = document.getElementById("error_message");
  const errorMessageStep3 = document.getElementById("error_message_step3");
  const errorMessageStep4 = document.getElementById("error_message_step4");
  const errorMessageStep5 = document.getElementById("error_message_step5");

  let currentStep = getSavedCurrentStep();
  const stepMaps = {
    0: "#step1",
    1: "#step2",
    2: "#step2",
    3: "#step3",
    4: "#step3",
    5: "#step3",
  };

  function showStep(index) {
    steps.forEach((step, i) => {
      step.classList.remove("active");
      if (i > index)
        document.querySelector(stepMaps[i])?.classList.remove("active");
      step.style.display = "none";
    });

    if (steps[index]) {
      steps[index].classList.add("active");
      document.querySelector(stepMaps[index])?.classList.add("active");
      steps[index].style.display = steps[index].classList.contains(
        "form_step_popup"
      )
        ? "flex"
        : "block";
    } else {
      console.error("Step index out of range:", index);
    }
    saveCurrentStep(index);
    onboardingHook({ steps: steps, current: steps[index], index: index });
  }

  async function isCurrentStepValid() {
    let valid = true;
    let errorMessages = [];

    try {
      switch (currentStep) {
        case 0: {
          const dropdown = document.getElementById("healthProviders");
          if (
            !dropdown ||
            dropdown.value.trim() === "" ||
            dropdown.value === null
          ) {
            valid = false;
            errorMessages.push(dictionary["error.healthProvider"]);
          } else if (valid) {
            setToStorage("selectedHealthProvider", dropdown.value.trim());
          }
          break;
        }
        case 1: {
          const checkboxesStep2 = document.querySelectorAll(
            ".card_select_checkbox:checked"
          );
          if (checkboxesStep2.length < 1) {
            valid = false;
            errorMessages.push(dictionary["error.selectOptions"]);
          } else if (checkboxesStep2.length > 2) {
            valid = false;
            errorMessages.push(dictionary["error.tooManyOptions"]);
          }
          break;
        }
        case 2: {
          const checkboxesStep3 = document.querySelectorAll(
            ".custom-checkbox-input:checked"
          );
          if (checkboxesStep3.length < 1) {
            valid = false;
            errorMessages.push(dictionary["error.selectOptions"]);
          }
          break;
        }
        case 3: {
          const cardResultCheckboxes = document.querySelectorAll(
            ".card_result_checkbox:checked"
          );
          if (cardResultCheckboxes.length < 1) {
            valid = false;
            errorMessages.push(dictionary["error.selectPrograms"]);
          }
          break;
        }
        case 4: {
          const popupConsent1 = document.getElementById("popupConsent1");
          const popupConsent2 = document.getElementById("popupConsent2");
          if (!popupConsent1.checked || !popupConsent2.checked) {
            valid = false;
            errorMessages.push(dictionary["error.agreeToTerms"]);
          }
          break;
        }
        case 5: {
          const form = document.getElementById("signUpForm");
          const userId = getUserIdSafe();
          const fields = {
            namePrefix: form.querySelector('select[name="namePrefix"]'),
            firstName: form.querySelector('input[name="firstName"]'),
            lastName: form.querySelector('input[name="lastName"]'),
            dateOfBirth: form.querySelector('input[name="dateOfBirth"]'),
            email: form.querySelector('input[name="email"]'),
            password: userId ? null : form.querySelector('input[name="password"]'),
            communicationViaEmail: form.querySelector('input[name="communication-via-email"]'),
            newsletterSignUp: form.querySelector('input[name="newsletter-sign-up"]'),
            privacyPolicy: form.querySelector('input[name="privacyPolicy"]'),
          };

          Object.values(fields).forEach(
            (field) => field && field.classList.remove("error")
          );

          const formData = {};
          const checkboxFields = ["communicationViaEmail", "newsletterSignUp", "privacyPolicy"];
          Object.entries(fields).forEach(([key, field]) => {
            if (!field) {
              if (key === "password" && userId) {
                return;
              }
              console.error(`Field ${key} not found`);
              valid = false;
              errorMessages.push(dictionary["error.requiredFields"]);
              return;
            }

            if (checkboxFields.includes(key)) {
              formData[key] = field.checked;
            } else {
              const value = field.value.trim();
              formData[key] = value;
              
              if (!value && !["communicationViaEmail", "newsletterSignUp", "privacyPolicy"].includes(key)) {
                field.classList.add("error");
                valid = false;
                switch (key) {
                  case "namePrefix":
                    errorMessages.push(dictionary["error.namePrefix"]);
                    break;
                  case "firstName":
                    errorMessages.push(dictionary["error.firstName"]);
                    break;
                  case "lastName":
                    errorMessages.push(dictionary["error.lastName"]);
                    break;
                  case "dateOfBirth":
                    errorMessages.push(dictionary["error.dateOfBirth"]);
                    break;
                  case "email":
                    errorMessages.push(dictionary["error.email"]);
                    break;
                  case "password":
                    if (!userId) {
                      errorMessages.push(dictionary["error.password"]);
                    }
                    break;
                }
              }

              if (key === "email" && value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                  field.classList.add("error");
                  valid = false;
                  errorMessages.push(dictionary["error.emailInvalid"]);
                }
              }

              if (key === "password" && value && value.length < 6 && !userId) {
                field.classList.add("error");
                valid = false;
                errorMessages.push(dictionary["error.passwordLength"]);
              }

              if (key === "dateOfBirth" && value) {
                const date = new Date(value);
                const today = new Date();
                const minAge = 18;
                const minDate = new Date();
                minDate.setFullYear(today.getFullYear() - minAge);
                if (isNaN(date.getTime()) || date > today || date > minDate) {
                  field.classList.add("error");
                  valid = false;
                  errorMessages.push(dictionary["error.ageRestriction"]);
                }
              }
            }

            if (key === "communicationViaEmail" && !field.checked) {
              field.classList.add("error");
              valid = false;
              errorMessages.push(dictionary["error.termsAndConditions"]);
            }
            if (key === "privacyPolicy" && !field.checked) {
              field.classList.add("error");
              valid = false;
              errorMessages.push(dictionary["error.privacyPolicy"]);
            }
          });

          if (valid) {
            const buttonText = getSubmitButtonText();
            if (buttonText && !buttonText.getAttribute("data-original-text")) {
              buttonText.setAttribute("data-original-text", buttonText.textContent);
            }
            
            setSubmitButtonLoading(true);
            
            try {
              const newsletterCheckbox = form.querySelector('input[name="newsletter-sign-up"]');
              if (newsletterCheckbox) {
                formData.newsletterSignUp = newsletterCheckbox.checked;
              }
              if (userId && formData.password) {
                delete formData.password;
              }
              saveFormData(formData);
              
              if (getFromStorage("trial", false)) {
                await createTrialUser();
                return;
              }
              
              await createUser();
              await ensureEmailVerifiedThenPay(calculateTotalPrice());
            } catch (error) {
              setSubmitButtonLoading(false);
              throw error;
            }
          }
          break;
        }
      }

      if (!valid) {
        switch (currentStep) {
          case 0:
            errorMessageStep1.innerHTML = errorMessages.join("<br>");
            errorMessageStep1.style.display = "block";
            break;
          case 1:
            errorMessageStep2.innerHTML = errorMessages.join("<br>");
            errorMessageStep2.style.display = "block";
            break;
          case 2:
            errorMessageStep3.innerHTML = errorMessages.join("<br>");
            errorMessageStep3.style.display = "block";
            break;
          case 3:
            errorMessageStep3.innerHTML = errorMessages.join("<br>");
            errorMessageStep3.style.display = "block";
            break;
          case 4:
            errorMessageStep4.innerHTML = errorMessages.join("<br>");
            errorMessageStep4.style.display = "block";
            break;
          case 5:
            errorMessageStep5.innerHTML = errorMessages.join("<br>");
            errorMessageStep5.style.display = "block";
            break;
        }
      } else {
        errorMessageStep2.style.display = "none";
        errorMessageStep3.style.display = "none";
        errorMessageStep4.style.display = "none";
        errorMessageStep5.style.display = "none";
      }

      return valid;
    } catch (error) {
      console.error("Validation error:", error);
      return false;
    }
  }

  // document.addEventListener("click", function (e) {
  //   const textEl = e.target.closest(".btn_main_text");
  //   if (!textEl) return;
  //   const label = textEl.textContent.trim();
  //   if (label !== "Jetzt kaufen") return;

  //   const buttonEl = textEl.closest("button");
  //   const linkEl = textEl.closest("a");

  //   if (buttonEl && !buttonEl.disabled) {
  //     buttonEl.disabled = true;
  //     buttonEl.classList.add("disabled");
  //     buttonEl.setAttribute("aria-disabled", "true");
  //   } else if (linkEl) {
  //     linkEl.classList.add("disabled");
  //     linkEl.setAttribute("aria-disabled", "true");
  //     linkEl.style.pointerEvents = "none";
  //     linkEl.style.opacity = "0.7";
  //   }
  // });

  async function handleNextClick(event) {
    event.preventDefault();

    try {
      const isValid = await isCurrentStepValid();
      if (!isValid) {
        return;
      }
      if (currentStep < steps.length - 1) {
        currentStep++;
        showStep(currentStep);
      }
    } catch (error) {
      console.error("Error in handleNextClick:", error);
    }
  }

  function handlePrevClick() {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  }

  function attachEventListeners() {
    [...nextBtns, submitBtn].forEach((btn) => {
      if (!btn) return;
      btn.removeEventListener("click", handleNextClick);
      btn.addEventListener("click", handleNextClick);
    });
    [...prevBtns].forEach((btn) => {
      btn.removeEventListener("click", handlePrevClick);
      btn.addEventListener("click", handlePrevClick);
    });
    const popupCloseBtn = document.querySelector("#popupClose");
    if (popupCloseBtn) popupCloseBtn.addEventListener("click", handlePrevClick);
    
    const surveyAgainBtn = document.querySelector("#do-survey-again");
    if (surveyAgainBtn) {
      surveyAgainBtn.addEventListener("click", function(e) {
        e.preventDefault();
        clearSurveyResults();
        currentStep = 1;
        saveCurrentStep(1);
        showStep(1);
      });
    }
  }

  function preventUncheckingCommunicationEmail() {
    const communicationCheckbox = document.querySelector('input[name="communication-via-email"]');
    if (communicationCheckbox) {
      communicationCheckbox.addEventListener('change', function(e) {
        if (!this.checked) {
          this.checked = true;
          console.log('Communication via email cannot be unchecked');
        }
      });
    }
  }

  const userData = getFromStorage("userData", {});
  if (userData.password) {
    delete userData.password;
    setToStorage("userData", userData);
  }

  fetchHealthProviders();
  fetchOnboardingSurvey();
  attachEventListeners();
  preventUncheckingCommunicationEmail();
  showStep(currentStep);

  const backToOnboarding = document.getElementById("back-to-onboarding");
  if (backToOnboarding) {
    backToOnboarding.addEventListener("click", (event) => {
      event.preventDefault();
      clearLocalStorageAfterPayment();
      resetSignupFormState();
      resetCheckoutView();
      currentStep = 0;
      saveCurrentStep(0);
      showStep(currentStep);
    });
  }

  setTimeout(() => {
    clearPasswordField();
    setupPasswordFieldCleanup();
  }, 500);

  const observer = new MutationObserver(() => {
    const passwordField = document.querySelector('input[name="password"]');
    if (passwordField && !passwordField._cleanupSetup) {
      setupPasswordFieldCleanup();
      clearPasswordField();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  const emailVerified = getUrlParameter("email-verified");
  if (emailVerified === "true" && window.location.pathname.includes("/onboarding")) {
    setTimeout(async () => {
      const currentStep = getSavedCurrentStep();
      if (currentStep >= 5) {
        await triggerFormSubmissionFlow(true);
      } else {
        const steps = document.querySelectorAll(
          ".form_step_wrap .form_step, .form_step_popup"
        );
        if (steps.length > 5) {
          const savedStep = getSavedCurrentStep();
          showStep(Math.max(5, savedStep));
          setTimeout(async () => {
            await triggerFormSubmissionFlow(true);
          }, 1000);
        }
      }
    }, 1500);
  }
});

/* -------------------- trial user -------------------- */
async function createTrialUser(showLoader = false) {
  try {
    const errorDiv = document.querySelector("#error_message_step5");
    errorDiv.style.display = "none";
    const userData = getFromStorage("userData", {});
    const userId = getUserIdSafe();
    const selectedCourses = getFromStorage("selectedCourses", []);
    const recommendedCourses = getFromStorage("recommendedCourses", []);
    const selectedHealthProvider = getFromStorage("selectedHealthProvider", "");
    const healthProviders = getFromStorage("healthProviders", {});
    const onboardingSurveyAnswers_1 = getFromStorage(
      "onboardingSurveyAnswers_1",
      []
    );
    const onboardingSurveyAnswers_2 = getFromStorage(
      "onboardingSurveyAnswers_2",
      []
    );

    const healthProviderData = healthProviders[selectedHealthProvider];
    const hasContraindications = getFilteredContraindications().length > 0;

    const payload = {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      dateOfBirth: userData.dateOfBirth,
      namePrefix: userData.namePrefix,
      newsletterSignUp: userData.newsletterSignUp || false,
      hasPreconditions: hasContraindications,
      isTrial: true,
      healthProvider: {
        maxCoursePrice: healthProviderData?.maxCoursePrice || "",
        name: selectedHealthProvider,
        numberOfCourses: recommendedCourses.length.toString(),
        takeover: healthProviderData?.takeover || "",
      },
      selectedCourses: selectedCourses.map((course) => course.toUpperCase()),
      onboarding: {
        answers: {
          step1: onboardingSurveyAnswers_1.map((item) => item.type),
          step2: onboardingSurveyAnswers_2.map((item) => item.type),
        },
      },
    };

    if (!userId && userData.password) {
      payload.password = userData.password;
    }

    setToStorage("createUserPayload", payload);

    const response = await fetch(getCreateUserBaseUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.success === false) {
      if (isEmailAlreadyInUse(data)) {
        const savedUserId = getFromStorage("userId", null);
        if (savedUserId) {
          setToStorage("createUserResponse", {
            userId: savedUserId,
            success: true,
          });
          setTimeout(() => {
            disableFormFieldsIfUserExists();
            hidePasswordFieldsIfUserExists();
          }, 100);
          await ensureEmailVerifiedThenCompleteTrial(showLoader);
          return { userId: savedUserId, success: true, skippedCreation: true };
        }
        const errorDiv = document.querySelector("#error_message_step5");
        if (errorDiv) {
          errorDiv.style.display = "block";
          errorDiv.textContent = dictionary["error.userExistsNoLocal"];
        }
        if (showLoader) hideFullscreenLoader();
        throw new Error(dictionary["error.userExistsNoLocal"]);
      }

      const errorDiv = document.querySelector("#error_message_step5");
      if (errorDiv) {
        errorDiv.style.display = "block";
        errorDiv.textContent = `${data.message || ""} ${
          data.error || ""
        }`.trim();
      }
      if (showLoader) hideFullscreenLoader();
      throw new Error(
        data.message || data.error || "Failed to create trial user"
      );
    }

    if (!response.ok || !data.success) {
      if (showLoader) hideFullscreenLoader();
      throw new Error(data.message || "Failed to create trial user");
    }

    setToStorage("createUserResponse", data);
    setToStorage("userId", data.userId);

    setTimeout(() => {
      disableFormFieldsIfUserExists();
      hidePasswordFieldsIfUserExists();
    }, 100);

    await ensureEmailVerifiedThenCompleteTrial(showLoader);
    return data;
  } catch (error) {
    setToStorage("createUserResponse", error);
    console.error("Error creating trial user:", error);
    if (showLoader) hideFullscreenLoader();
    throw error;
  }
}
