/* eslint-disable no-case-declarations */
/* eslint-disable no-undef */

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
  "error.paymentIncomplete": "Die Zahlung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.",
  "error.invoice": "Rechnung konnte nicht erstellt werden",
  "error.userCreation": "Fehler beim Erstellen des Benutzerkontos",
  "error.validation": "Bitte überprüfen Sie Ihre Eingaben",
  "success.registration": "Registrierung erfolgreich",
  "success.payment": "Zahlung erfolgreich",
  "success.invoice": "Rechnung wurde erstellt und per E-Mail versandt",
  "button.closePayment": "Zahlungsfenster schließen",
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
async function fetchHealthProviders() {
  try {
    const response = await fetch(getDocumentFromFireBase("healthInsuranceProviders"));
    const data = await response.json();

    if (data.success && Object.keys(data.data).length > 0) {
      setToStorage("healthProviders", data.data);
      populateDropdown(Object.keys(data.data));
    } else {
      console.error("Invalid response structure:", data);
    }
  } catch (error) {
    console.error("Error fetching health providers:", error);
  }
}

function populateDropdown(providers) {
  const dropdown = document.querySelector("#healthProviders");
  const disclaimer = document.querySelector(".input_disclaimer");
  dropdown.disabled = true;

  dropdown.innerHTML = `<option value="">${dictionary["select.healthProvider"]}</option>`;
  providers.forEach((provider) => {
    const option = document.createElement("option");
    option.value = provider;
    option.textContent = provider;
    dropdown.appendChild(option);
  });

  function handleDropdownChange(event) {
    const selectedProvider = event.target.value;
    setToStorage("selectedHealthProvider", selectedProvider);

    if (disclaimer) disclaimer.style.visibility = "visible";

    const healthProviders = getFromStorage("healthProviders", {});
    const hp = healthProviders[selectedProvider];

    const takeoverEl = document.querySelector("#takeover");
    if (takeoverEl) takeoverEl.innerHTML = hp?.takeover || "";

    updateInfoBox(selectedProvider);
  }

  dropdown.disabled = false;
  dropdown.addEventListener("change", handleDropdownChange);

  const saved = getFromStorage("selectedHealthProvider", "");
  if (saved && providers.includes(saved)) {
    dropdown.value = saved;

    const hp = getFromStorage("healthProviders", {})[saved] || {};
    const takeoverEl = document.querySelector("#takeover");
    if (takeoverEl) takeoverEl.innerHTML = hp.takeover || "";

    updateInfoBox(saved);
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
    if (healthContraindications) setToStorage("contraindications", healthContraindications);
  } catch (error) {
    console.error(error);
  }
}

function getFilteredContraindications() {
  const recommendedCourses = getFromStorage("recommendedCourses", []);
  const contraindications = getFromStorage("contraindications", []);
  return contraindications.filter((c) => recommendedCourses.includes(c.course_slug));
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
  if (onboardingSurvey?.length) setToStorage("onboardingSurvey", onboardingSurvey);
  return onboardingSurvey;
}

/* -------------------- onboarding UI -------------------- */
async function populateOnboardingSurveyStep1() {
  const onboardingSurvey = getFromStorage("onboardingSurvey", [])?.[0]?.answers;
  if (onboardingSurvey?.length) {
    const container = document.querySelector("#coursesContainer");
    container.innerHTML = "";
    onboardingSurvey.forEach((data) => {
      const item = renderCourseItem(data.id, data.type, data.text, data.image_cover.filename);
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
  const selectedCheckboxes = document.querySelectorAll("#coursesContainer .card_select_checkbox:checked");
  const answeredIds = Array.from(selectedCheckboxes).map((checkbox) => checkbox.getAttribute("data-id"));
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
  const selectedCheckboxes = document.querySelectorAll(".custom-checkbox-input:checked");
  const surveyAnswers = Array.from(selectedCheckboxes).map((checkbox) => checkbox.id);
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
      <input type="checkbox" name="checkout" data-name="checkout" data-value="${slug}" class="w-checkbox-input card_result_checkbox" ${checked ? "checked" : ""}>
      <span class="card_select_label w-form-label"></span>
      <div class="card_result_content u-vflex-stretch-top u-gap-2">
        <div class="card_result_h_wrap u-hflex-between-top u-gap-4">
          <h4 style="max-width: 210px; hyphens: auto;">${title}</h4>
          <div class="icon_small is-checkmark" style="background-color:${checked ? color : DEFAULT_CHECKMARK_COLOR}">
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
    checkmark.style.backgroundColor = this.checked ? color : DEFAULT_CHECKMARK_COLOR;
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
    const additional = { STRESS: "FITNESS", FITNESS: "NUTRITION", NUTRITION: "STRESS" }[selectedType];
    if (additional) typeCounts[additional] = 1;
  }

  const recommendedTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type]) => type);

  const recommendedCourses = courses.filter((c) => recommendedTypes.includes(c.slug)).map((c) => c.slug);
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
    takeoverSummary.innerHTML = healthProviders[selectedHealthProvider].takeover;

  const price = document.querySelector("#price");
  if (price) price.innerHTML = calculateTotalPrice() + CURRENCY;

  const coursesCountElement = document.querySelector(".courses-info-duration");
  const overviewCoursesCountElement = document.querySelector(".course-duration-overview");
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

  const subscriptionLengthElement = document.querySelector("#subscriptionLength");
  if (subscriptionLengthElement) {
    subscriptionLengthElement.innerHTML = getFromStorage("selectedCourses", []).length === 1 ? "12" : "18";
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
  const selectedCheckboxes = document.querySelectorAll(".card_result_checkbox:checked");
  const button = getSiblingButtonBySelector("#button_purchase_onb_recommendation", "button");
  const coursesSlugs = Array.from(selectedCheckboxes).map((checkbox) => checkbox.getAttribute("data-value"));
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
      const courseData = getFromStorage("courses", [])?.find((item) => item.slug === course);
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
    if (event.target.classList.contains("card_result_checkbox")) onCourseSelected();
  });
  onCourseSelected();
}

function renderContraindicationItem(slug, name, contraindications) {
  const template = document.createElement("template");
  template.innerHTML = `
    <div class="dropdown_content">
      <div class="program_name">Programm: ${name}</div>
      <ul role="list" class="program_list">
        ${contraindications.map((c) => `<li class="program_list_item">${c.contraindication}</li>`).join("")}
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
    const buttons = Array.from(document.querySelectorAll(".btn_main_text")).filter((btn) => btn.textContent === "Jetzt kaufen");
    buttons.forEach((button) => (button.innerHTML = "Kurseinheit ausprobieren"));
    return;
  }

  filteredCourses.forEach((course) => {
    if (selectedCourses.includes(course.slug)) {
      const item = renderCheckoutItem(course.name, "", "", pricePerCourse);
      container.appendChild(item);
    }
  });
  if (totalContainer) totalContainer.innerHTML = calculateTotalPrice().toFixed(2) + CURRENCY;
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

function renderCheckoutCourseItem(imageSrc, title, description, price, badgeText, badgeColor) {
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
    if (!response.ok) throw new Error(data.message || "Failed to generate invoice");
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
    if (!response.ok) throw new Error(data.message || "Failed to send welcome email");
    return data;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return null;
  }
}

async function doPayment(amount) {
  try {
    const registerButtonText = getSiblingButtonBySelector("#registerFormSubmitButton", ".btn_main_text");
    if (registerButtonText) registerButtonText.textContent = dictionary["payment.processing"];
    const errorDiv = document.querySelector("#error_message_payment");

    if (!stripe) await initializeStripe();

    const userData = getFromStorage("userData", {});
    const body = {
      amount: amount * 100,
      userId: getFromStorage("createUserResponse", {}).userId,
      courseSlugs: getFromStorage("selectedCourses", []),
    };

    setToStorage("paymentIntentPayload", body);
    const response = await fetch("https://europe-west3-mind-c3055.cloudfunctions.net/createPaymentIntent", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to create payment intent");

    setToStorage("paymentIntentResponse", data);
    const clientSecret = data.paymentIntent;
    if (!clientSecret) throw new Error("No client secret received from payment intent");

    const elements = stripe.elements({
      clientSecret,
      locale: "de",
      appearance: { theme: "stripe", variables: { colorPrimary: "#5469d4" } },
      loader: "auto",
    });

    const paymentElement = elements.create("payment");
    const popupWrap = document.querySelector("#payment_popup_wrapper");
    popupWrap.classList.add("active");
    popupWrap.style.display = "flex";

    const submitButton = getSiblingButtonBySelector("#submit_payment", "button");
    const submitButtonText = getSiblingButtonBySelector("#submit_payment", ".btn_main_text");

    paymentElement.mount("#payment_element");

    const closeButton = document.createElement("div");
    closeButton.innerHTML = `
      <div style="text-align: center; margin-top: 20px;">
        <a href="#" id="close_payment_window" style="text-decoration: underline; color: #666; font-size: 14px; cursor: pointer;">
          ${dictionary["button.closePayment"]}
        </a>
      </div>
    `;
    
    const paymentGatewayContainer = document.querySelector(".payment_gateway_contain");
    if (paymentGatewayContainer) {
      paymentGatewayContainer.appendChild(closeButton);
    }

    const closePaymentLink = document.querySelector("#close_payment_window");
    if (closePaymentLink) {
      closePaymentLink.addEventListener("click", (e) => {
        e.preventDefault();
        popupWrap.classList.remove("active");
        popupWrap.style.display = "none";
        if (registerButtonText) registerButtonText.textContent = dictionary["payment.payNow"];
      });
    }

    submitButton.addEventListener("click", async (event) => {
      if (submitButtonText) submitButtonText.textContent = dictionary["payment.processing"];
      event.preventDefault();
      submitButton.disabled = true;

      try {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          redirect: "if_required",
          confirmParams: {
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
          const programSlugs = selectedCourses.map((course) => course.toUpperCase());

          await handlePurchaseAndInvoice(paymentIntent.id, amount, userId);
          await sendWelcomeEmail(userId, programSlugs);

          window.location.href = window.location.href.replace("onboarding", "vielen-dank");
        } else {
          errorDiv.style.display = "block";
          errorDiv.textContent = dictionary["error.paymentIncomplete"];
        }
      } catch (error) {
        console.error("Payment error:", error);
        errorDiv.style.display = "block";
        errorDiv.textContent = error?.message ?? error.toString();
      } finally {
        if (registerButtonText) registerButtonText.textContent = dictionary["payment.payNow"];
        if (submitButtonText) submitButtonText.textContent = dictionary["payment.payNow"];
        submitButton.disabled = false;
      }
    });
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
    const onboardingSurveyAnswers_1 = getFromStorage("onboardingSurveyAnswers_1", []);
    const onboardingSurveyAnswers_2 = getFromStorage("onboardingSurveyAnswers_2", []);

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
      hasPreconditions: hasContraindications,
      healthProvider: {
        maxCoursePrice: healthProviderData.maxCoursePrice || "",
        name: selectedHealthProvider,
        numberOfCourses: recommendedCourses.length.toString(),
        takeover: healthProviderData.takeover || "",
      },
      paidCourses: paidCourses,
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

    if (data.success === false && data.message) {
      errorDiv.style.display = "block";
      errorDiv.textContent = `${data.message}  ${data.error}`;
    }

    if (!response.ok || !data.success) throw new Error(data.message || "Failed to create user");

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
  const steps = document.querySelectorAll(".form_step_wrap .form_step, .form_step_popup");
  const prevBtns = document.querySelectorAll("[data-btn-prev]");
  const nextBtns = [...document.querySelectorAll("[data-btn-next]"), document.querySelector("#button_trial")];
  const submitBtn = document.querySelector("[data-btn-submit]");
  const errorMessageStep1 = document.getElementById("error_message_step1");
  const errorMessageStep2 = document.getElementById("error_message");
  const errorMessageStep3 = document.getElementById("error_message_step3");
  const errorMessageStep4 = document.getElementById("error_message_step4");
  const errorMessageStep5 = document.getElementById("error_message_step5");

  let currentStep = 0;
  const stepMaps = { 0: "#step1", 1: "#step2", 2: "#step2", 3: "#step3", 4: "#step3" };

  function showStep(index) {
    steps.forEach((step, i) => {
      step.classList.remove("active");
      if (i > index) document.querySelector(stepMaps[i])?.classList.remove("active");
      step.style.display = "none";
    });

    if (steps[index]) {
      steps[index].classList.add("active");
      document.querySelector(stepMaps[index])?.classList.add("active");
      steps[index].style.display = steps[index].classList.contains("form_step_popup") ? "flex" : "block";
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
          if (!dropdown || dropdown.value.trim() === "" || dropdown.value === null) {
            valid = false;
            errorMessages.push(dictionary["error.healthProvider"]);
          }
          break;
        }
        case 1: {
          const checkboxesStep2 = document.querySelectorAll(".card_select_checkbox:checked");
          if (checkboxesStep2.length < 1 || checkboxesStep2.length > 2) {
            valid = false;
            errorMessages.push(dictionary["error.selectOptions"]);
          }
          break;
        }
        case 2: {
          const checkboxesStep3 = document.querySelectorAll(".custom-checkbox-input:checked");
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
            consent1: form.querySelector('input[name="consent1"]'),
            privacyPolicy: form.querySelector('input[name="privacyPolicy"]'),
          };

          Object.values(fields).forEach((field) => field && field.classList.remove("error"));

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

            if (!value && !["consent1", "privacyPolicy"].includes(key)) {
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

            if (key === "consent1" && !field.checked) {
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
            setToStorage("userData", formData);
            if (getFromStorage("trial", false)) {
              await createTrialUser();
              return;
            }
            await createUser();
            await doPayment(calculateTotalPrice());
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

  async function handleNextClick(event) {
    event.preventDefault();
    try {
      const isValid = await isCurrentStepValid();
      if (!isValid) return;
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

  fetchHealthProviders();
  fetchOnboardingSurvey();
  attachEventListeners();
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
    const onboardingSurveyAnswers_1 = getFromStorage("onboardingSurveyAnswers_1", []);
    const onboardingSurveyAnswers_2 = getFromStorage("onboardingSurveyAnswers_2", []);

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
    setToStorage("createUserResponse", data);
    setToStorage("userId", data.userId);

    if (!response.ok || !data.success) {
      if (data.message) {
        errorDiv.style.display = "block";
        errorDiv.textContent = `${data.message}  ${data.error}`;
      }
      throw new Error(data.message || "Failed to create trial user");
    }

    window.location.href = window.location.href.replace("onboarding", "vielen-dank");
    return data;
  } catch (error) {
    setToStorage("createUserResponse", error);
    console.error("Error creating trial user:", error);
    throw error;
  }
}
