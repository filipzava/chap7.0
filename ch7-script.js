/* eslint-disable no-case-declarations */
/* eslint-disable no-undef */
function isEmailAlreadyInUse(resp) {
  const msg = `${resp?.message || ""} ${resp?.error || ""}`.toLowerCase();
  return (
    msg.includes("already in use") || msg.includes("auth/email-already-in-use")
  );
}
const dictionary = {
  "error.namePrefix": "Bitte wählen Sie Ihre Anrede aus",
  "error.firstName": "Bitte geben Sie Ihren Vornamen ein",
  "error.lastName": "Bitte geben Sie Ihren Nachnamen ein",
  "error.dateOfBirth": "Bitte geben Sie Ihr Geburtsdatum ein",
  "error.email": "Bitte geben Sie Ihre E-Mail-Adresse ein",
  "error.emailInvalid": "Bitte geben Sie eine gültige E-Mail-Adresse ein",
  "error.password": "Bitte geben Sie ein Passwort ein",
  "error.passwordLength": "Das Passwort muss mindestens 6 Zeichen lang sein",
  "error.ageRestriction": "Sie müssen mindestens 18 Jahre alt sein",
  "error.termsAndConditions": "Bitte stimmen Sie den Nutzungsbedingungen zu",
  "error.privacyPolicy": "Bitte stimmen Sie der Datenschutzerklärung zu",
  "error.requiredFields": "Bitte füllen Sie alle erforderlichen Felder aus",
  "error.healthProvider": "Bitte wählen Sie eine Krankenkasse aus",
  "error.selectOptions": "Bitte wählen Sie mehr als 1 Option aus",
  "error.agreeToTerms": "Bitte stimmen Sie beiden Bedingungen zu",
  "select.healthProvider": "Bitte Krankenkasse wählen",
  "payment.processing": "Wird bearbeitet ...",
  "payment.payNow": "Jetzt bezahlen",
  "payment.discount": "Rabatt",
  "button.next": "Weiter",
  "button.back": "Zurück",
  "button.submit": "Absenden",
  "error.payment": "Zahlungsfehler aufgetreten",
  "error.paymentIncomplete":
    "Die Zahlung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.",
  "error.invoice": "Rechnung konnte nicht erstellt werden",
  "error.userCreation": "Fehler beim Erstellen des Benutzerkontos",
  "error.validation": "Bitte überprüfen Sie Ihre Eingaben",
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
    populateNamePrefix();
  } else if (index === 5) {
    populateCheckout();
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
    setToStorage("selectedHealthProvider", selectedProvider);

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

  btnCancel.addEventListener("click", () => hideEmailVerifyModal());
  btnClose.addEventListener("click", () => hideEmailVerifyModal());
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

async function ensureEmailVerifiedThenPay(amount) {
  const userId = getUserIdSafe();
  if (!userId) {
    console.error("No userId found for email verification.");
    const errDiv = document.querySelector("#error_message_step5");
    if (errDiv) {
      errDiv.style.display = "block";
      errDiv.textContent = "Unbekannter Fehler: Benutzer nicht gefunden.";
    }
    return;
  }

  const verified = await apiIsEmailVerified(userId);
  if (verified) {
    await doPayment(amount);
    return;
  }

  wireEmailVerifyModal({
    userId,
    onVerified: () => doPayment(amount),
  });
  showEmailVerifyModal();
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

async function completeOnboarding(userId) {
  try {
    const response = await fetch(`${API}/complete-onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
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

async function doPayment(amount) {
  try {
    const registerButtonText = getSiblingButtonBySelector(
      "#registerFormSubmitButton",
      ".btn_main_text"
    );
    if (registerButtonText)
      registerButtonText.textContent = dictionary["payment.processing"];
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
      "https://europe-west3-mind-c3055.cloudfunctions.net/createPaymentIntent",
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
        if (registerButtonText)
          registerButtonText.textContent = dictionary["payment.payNow"];
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

            await handlePurchaseAndInvoice(paymentIntent.id, amount, userId);
            await sendWelcomeEmail(userId, programSlugs);
            await completeOnboarding(userId);

            localStorage.removeItem("userId");
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
    throw error;
  }
}

/* -------------------- user creation -------------------- */
async function createUser() {
  try {
    const errorDiv = document.querySelector("#error_message_step5");
    errorDiv.style.display = "none";
    const userData = getFromStorage("userData", {});
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

    const paidCourses = selectedCourses.map((course) => {
      const validTill = new Date();
      validTill.setFullYear(validTill.getFullYear() + 1);
      return {
        course: course.toUpperCase(),
        status: "valid",
        validTill: validTill.toISOString().split("T")[0],
      };
    });

    const healthProviderData = healthProviders[selectedHealthProvider];
    const hasContraindications = getFilteredContraindications().length > 0;

    const payload = {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: userData.password,
      dateOfBirth: userData.dateOfBirth,
      namePrefix: userData.namePrefix,
      newsletterSignUp: userData.newsletterSignUp || false,
      hasPreconditions: hasContraindications,
      healthProvider: {
        maxCoursePrice: healthProviderData.maxCoursePrice || "",
        name: selectedHealthProvider,
        numberOfCourses: recommendedCourses.length.toString(),
        takeover: healthProviderData.takeover || "",
      },
      selectedCourses: selectedCourses.map((course) => course.toUpperCase()),
      onboarding: {
        answers: {
          step1: onboardingSurveyAnswers_1.map((item) => item.type),
          step2: onboardingSurveyAnswers_2.map((item) => item.type),
        },
      },
    };

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

  let currentStep = 0;
  const stepMaps = {
    0: "#step1",
    1: "#step2",
    2: "#step2",
    3: "#step3",
    4: "#step3",
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
          }
          break;
        }
        case 1: {
          const checkboxesStep2 = document.querySelectorAll(
            ".card_select_checkbox:checked"
          );
          if (checkboxesStep2.length < 1 || checkboxesStep2.length > 2) {
            valid = false;
            errorMessages.push(dictionary["error.selectOptions"]);
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
          const fields = {
            namePrefix: form.querySelector('select[name="namePrefix"]'),
            firstName: form.querySelector('input[name="firstName"]'),
            lastName: form.querySelector('input[name="lastName"]'),
            dateOfBirth: form.querySelector('input[name="dateOfBirth"]'),
            email: form.querySelector('input[name="email"]'),
            password: form.querySelector('input[name="password"]'),
            communicationViaEmail: form.querySelector('input[name="communication-via-email"]'),
            newsletterSignUp: form.querySelector('input[name="newsletter-sign-up"]'),
            privacyPolicy: form.querySelector('input[name="privacyPolicy"]'),
          };

          Object.values(fields).forEach(
            (field) => field && field.classList.remove("error")
          );

          const formData = {};
          Object.entries(fields).forEach(([key, field]) => {
            if (!field) {
              console.error(`Field ${key} not found`);
              valid = false;
              errorMessages.push(dictionary["error.requiredFields"]);
              return;
            }

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
                  errorMessages.push(dictionary["error.password"]);
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

            if (key === "password" && value && value.length < 6) {
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
            const newsletterCheckbox = form.querySelector('input[name="newsletter-sign-up"]');
            if (newsletterCheckbox) {
              formData.newsletterSignUp = newsletterCheckbox.checked;
            }
            setToStorage("userData", formData);
            if (getFromStorage("trial", false)) {
              await createTrialUser();
              return;
            }
            await createUser();
            await ensureEmailVerifiedThenPay(calculateTotalPrice());
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

  fetchHealthProviders();
  fetchOnboardingSurvey();
  attachEventListeners();
  preventUncheckingCommunicationEmail();
  showStep(currentStep);
});

/* -------------------- trial user -------------------- */
async function createTrialUser() {
  try {
    const errorDiv = document.querySelector("#error_message_step5");
    errorDiv.style.display = "none";
    const userData = getFromStorage("userData", {});
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

    const trialValidTill = new Date();
    trialValidTill.setDate(trialValidTill.getDate() + 14);
    const trialValidTillStr = trialValidTill.toISOString().split("T")[0];

    const paidCourses = selectedCourses.map((course) => ({
      course: course.toUpperCase(),
      status: "active",
      validTill: null,
      isTrial: true,
      trialValidTill: trialValidTillStr,
    }));

    const healthProviderData = healthProviders[selectedHealthProvider];
    const hasContraindications = getFilteredContraindications().length > 0;

    const payload = {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: userData.password,
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
      paidCourses,
      selectedCourses: selectedCourses.map((course) => course.toUpperCase()),
      onboarding: {
        answers: {
          step1: onboardingSurveyAnswers_1.map((item) => item.type),
          step2: onboardingSurveyAnswers_2.map((item) => item.type),
        },
      },
    };

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
          window.location.href = window.location.href.replace(
            "onboarding",
            "vielen-dank"
          );
          return { userId: savedUserId, success: true, skippedCreation: true };
        }
        const errorDiv = document.querySelector("#error_message_step5");
        if (errorDiv) {
          errorDiv.style.display = "block";
          errorDiv.textContent = dictionary["error.userExistsNoLocal"];
        }
        throw new Error(dictionary["error.userExistsNoLocal"]);
      }

      const errorDiv = document.querySelector("#error_message_step5");
      if (errorDiv) {
        errorDiv.style.display = "block";
        errorDiv.textContent = `${data.message || ""} ${
          data.error || ""
        }`.trim();
      }
      throw new Error(
        data.message || data.error || "Failed to create trial user"
      );
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to create trial user");
    }

    setToStorage("createUserResponse", data);
    setToStorage("userId", data.userId);

    window.location.href = window.location.href.replace(
      "onboarding",
      "vielen-dank"
    );
    return data;
  } catch (error) {
    setToStorage("createUserResponse", error);
    console.error("Error creating trial user:", error);
    throw error;
  }
}
