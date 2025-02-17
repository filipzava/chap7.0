/* eslint-disable no-case-declarations */
/* eslint-disable no-undef */

const PUBLISHABLE_KEY =
  "pk_test_51QPhSmIjMlCwpKLpOSWig7J6FCQyFQ5NEysG3mXGy5tzXfZ61wwdGDSU2m6qPO8QwWeUMokteES3SyTUJlqJF6JP00zRyrYPId";

let stripe; 

const CURRENCY = "€";


function getDocumentFromFireBase(document) {
  return `${API}/getConfigData?document=${document}`;
}

function getCreateUserBaseUrl() {
  return `${API}/createUser`;
}

function getWebflowStory(slug) {
  return `${API}/getWebflowStory?slug=${slug}&draft=true`;
}

// Add these helper functions
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



function onboardingHook({ current, index }) {
  console.log({ current, index });
  if (index === 0) {
    fetchHealthProviders();
    fetchPricing();
    fetchContraindications();
  } else if (index === 1) {
    populateCourses();
  } else if (index === 2) {
    getSelectedCourses();
    populateOnboardingSurvey();
  } else if (index === 3) {
    getCheckedSurveyAnswers();
    populateSummary();
  } else if (index === 4) {
    populateContraindications();
  } else if (index === 5) {
    populateNamePrefix();
    populateCheckout();
  }
}

async function fetchHealthProviders() {
  try {
    const response = await fetch(getDocumentFromFireBase("healthProviders"));
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
  // Set disabled state initially
  dropdown.disabled = true;

  dropdown.innerHTML = `<option value="">Bitte Krankenkasse wählen</option>`; // Default option

  providers.forEach((provider) => {
    const option = document.createElement("option");
    option.value = provider;
    option.textContent = provider;
    dropdown.appendChild(option);
  });

  function handleDropdownChange(event) {
    const selectedProvider = event.target.value;
    dropdown.value = selectedProvider;
    disclaimer.style.visibility = "visible";
    setToStorage("selectedHealthProvider", selectedProvider);
    const healthProviders = getFromStorage("healthProviders", {});
    document.querySelector("#takeover").innerHTML =
      healthProviders[selectedProvider].takeover;
  }

  // Enable dropdown after populating options
  dropdown.disabled = false;

  dropdown.addEventListener("change", handleDropdownChange);
}

async function fetchPricing() {
  try {
    const res = await fetch(getDocumentFromFireBase("pricing"));
    const data = await res.json();

    if (data.success && data.data) {
      setToStorage("pricing", data.data);
    }
  } catch (error) {
    console.error(error);
  }
}

async function fetchContraindications() {
  try {
    const res = await fetch(getWebflowStory("health-contraindications"));
    const data = await res.json();
    const healthContraindications = data.story?.content?.contraindications;
    if (healthContraindications) {
      setToStorage("contraindications", healthContraindications);
    }
  } catch (error) {
    console.error(error);
  }
}

function getFilteredContraindications() {
  const selectedCourses = getFromStorage("selectedCourses", []);
  const contraindications = getFromStorage("contraindications", []);
  return contraindications.filter((contraindication) =>
    selectedCourses.includes(contraindication.course_slug)
  );
}

async function populateCourses() {
  const res = await fetch(getDocumentFromFireBase("courses"));

  const data = await res.json();

  if (data.success && data.data["courses-info"].length) {
    setToStorage("courses", data.data["courses-info"]);
    const container = document.querySelector("#coursesContainer");
    container.innerHTML = "";
    data.data["courses-info"].forEach((data) => {
      const item = renderCourseItem(
        data.slug,
        data.recommendation_description,
        "https://cdn.prod.website-files.com/676e8e3a573b707f2be07685/677d7fc464ea793a4794a3a2_image%20112.webp"
      );
      container.appendChild(item);
    });
  }
}

function renderCourseItem(value, text, imgSrc) {
  const template = document.createElement("template");
  template.innerHTML = `<label class="w-checkbox form_card_select">
          <div class="card_form_img_contain">
            <img src="${imgSrc}" 
                 loading="lazy" 
                 sizes="100vw" 
                 alt="" 
                 class="card_select_img">
          </div>
          <input type="checkbox" name="step1[]" data-name="step1[]" data-value="${value}" class="w-checkbox-input card_select_checkbox">
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

function getSelectedCourses() {
  const selectedCheckboxes = document.querySelectorAll(
    "#coursesContainer .card_select_checkbox:checked"
  );

  const selectedCourses = Array.from(selectedCheckboxes).map((checkbox) =>
    checkbox.getAttribute("data-value")
  );
  setToStorage("selectedCourses", selectedCourses);
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

async function populateOnboardingSurvey() {
  const res = await fetch(getWebflowStory("onboarding-survey"));
  const selectedCourses = getFromStorage("selectedCourses", []);
  const data = await res.json();
  const surveyData =
    data?.story?.content?.onboarding_survey_steps?.[1]?.answers;
  if (surveyData.length) {
    setToStorage("onboardingSurvey", surveyData);
    const container = document.querySelector("#onboardingSurvey");
    container.innerHTML = "";
    surveyData
      .filter((item) => selectedCourses.includes(item.type))
      .forEach((data) => {
        const item = renderOnboardingSurveyItem(data.id, data.type, data.text);
        container.appendChild(item);
      });
  }
}

function getCheckedSurveyAnswers() {
  const selectedCheckboxes = document.querySelectorAll(
    ".custom-checkbox-input:checked"
  );

  const surveyAnswers = Array.from(selectedCheckboxes).map(
    (checkbox) => checkbox.id
  );
  setToStorage("onboardingSurveyAnswers", surveyAnswers);
}

function renderCardResult(imageSrc, title, text, color) {
  const template = document.createElement("template");
  template.innerHTML = `
        <div class="card_result">
          <div class="card_form_img_contain">
            <img src="${imageSrc}" loading="lazy" sizes="100vw" alt="" class="card_select_img">
          </div>
          <div class="card_result_content u-vflex-stretch-top u-gap-2">
            <div class="card_result_h_wrap u-hflex-between-center u-gap-4">
              <h4>${title}</h4>
              <div class="icon_small is-checkmark" style="background-color: ${color}">
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 22 22" fill="none">
                  <path d="M9.16667 15.0334L5.5 11.3667L6.78333 10.0834L9.16667 12.4667L15.2167 6.41675L16.5 7.70008L9.16667 15.0334Z" fill="white"></path>
                </svg>
              </div>
            </div>
            <div>${text}</div>
          </div>
        </div>`;

  return template.content.firstElementChild;
}

function populateSummary() {
  const container = document.querySelector("#summary");
  const filteredCourses = getFromStorage("courses", []);
  const selectedCourses = getFromStorage("selectedCourses", []);
  filteredCourses.forEach((course) => {
    if (selectedCourses.includes(course.slug)) {
      container.prepend(
        renderCardResult(
          "https://cdn.prod.website-files.com/676e8e3a573b707f2be07685/677d7fc464ea793a4794a3a2_image%20112.webp",
          course.name,
          course.recommendation_description,
          course.course_color
        )
      );
    }
  });
  fillSummaryStepData();
}

function fillSummaryStepData() {
  const takeoverSummary = document.querySelector("#takeoverSummary");
  const selectedHealthProvider = getFromStorage("selectedHealthProvider", "");
  const healthProviders = getFromStorage("healthProviders", {});
  takeoverSummary.innerHTML = healthProviders[selectedHealthProvider].takeover;

  const price = document.querySelector("#price");
  price.innerHTML = calculateTotalPrice() + CURRENCY;

  const coursesCountElement = document.querySelector("#coursesCount");
  coursesCountElement.innerHTML = getFromStorage("selectedCourses", []).length;
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
        contraindications.filter(
          (contraindication) => contraindication.course_slug === course.slug
        )
      );
      container.appendChild(item);
    }
  });
}

function renderContraindicationItem(slug, name, contraindications) {
  const template = document.createElement("template");
  template.innerHTML = `
    <div class="dropdown_content">
      <div class="program_name">Programm: ${name}</div>
      <ul role="list" class="program_list">
        ${contraindications
          .map(
            (contraindication) =>
              `<li class="program_list_item">${contraindication.contraindication}</li>`
          )
          .join("")}
      </ul>
    </div>`;
  return template.content.firstElementChild;
}

function calculateTotalPrice() {
  const pricing = getFromStorage("pricing", {});
  const selectedCourses = getFromStorage("selectedCourses", []);
  
  if (selectedCourses.length === 2) {
    return Number(pricing.twoCoursesPrice);
  } else if (selectedCourses.length === 1) {
    return Number(pricing.singleCoursePrice);
  }
  return 0;
}

// Add this utility function near the other utility functions
function calculateDiscountPercentage() {
  const pricing = getFromStorage("pricing", {});
  const selectedCourses = getFromStorage("selectedCourses", []);
  
  if (selectedCourses.length === 2) {
    const regularPrice = Number(pricing.singleCoursePrice) * 2;
    const discountedPrice = Number(pricing.twoCoursesPrice);
    const discount = ((regularPrice - discountedPrice) / regularPrice) * 100;
    return Math.round(discount); // Round to nearest integer
  }
  return 0;
}

// Update populateCheckout to use the new utility function
function populateCheckout() {
  const container = document.querySelector("#productList");
  const totalContainer = document.querySelector("#priceTotal");
  const filteredCourses = getFromStorage("courses", []);
  const selectedCourses = getFromStorage("selectedCourses", []);
  const pricing = getFromStorage("pricing", {});

  const discountPercentage = calculateDiscountPercentage();
  const priceOld = selectedCourses.length === 2 ? Number(pricing.singleCoursePrice) : "";
  const priceNew = selectedCourses.length === 2 
    ? Number(pricing.twoCoursesPrice) / 2 
    : Number(pricing.singleCoursePrice);

  filteredCourses.forEach((course) => {
    if (selectedCourses.includes(course.slug)) {
      const item = renderCheckoutItem(
        course.name,
        discountPercentage ? `${discountPercentage}%` : "",
        priceOld,
        priceNew
      );
      container.appendChild(item);
    }
  });
  
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
                ${
                  badgeText
                    ? `<div class="badge is-rabatt"><div><span>${badgeText}</span> Rabatt</div></div>`
                    : ""
                }
                <div class="price_text_new">${priceNew}€</div>
                ${
                  priceOld
                    ? `<div class="price_text_full text-decoration-strikethrough">${priceOld}€</div>`
                    : ""
                }
            </div>
        </div>
    </div>
  `;

  return wrapper;
}

function renderCheckoutCourseItem(
  imageSrc,
  title,
  description,
  priceOld,
  priceNew,
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
          <div class="card_product_price">
            <div class="price_text_new">${priceNew}${CURRENCY}</div>
            <div class="price_text_full text-decoration-strikethrough">${priceOld}</div>
          </div>
        </div>
        <div class="product_description">${description}</div>
        <div class="badge is-border u-align-self-start">
          <div class="badge_text_small" style="color: ${badgeColor}">${badgeText}</div>
        </div>
      </div>
    </div>`;

  return template.content.firstElementChild;
}

// Add this function to initialize Stripe
async function initializeStripe() {
  if (typeof Stripe === "undefined") {
    // Load Stripe.js if it hasn't been loaded
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    document.head.appendChild(script);

    // Wait for script to load
    await new Promise((resolve) => {
      script.onload = resolve;
    });
  }

  // Initialize Stripe with your publishable key
  // eslint-disable-next-line no-undef
  stripe = Stripe(PUBLISHABLE_KEY);
  return stripe;
}

// Modify the doPayment function
async function doPayment(amount) {
  try {
    const registerButton = document.querySelector("#registerFormSubmitButton").querySelector(".btn_main_text");
    registerButton.textContent = "Processing ....";
    // Initialize Stripe if not already initialized
    if (!stripe) {
      await initializeStripe();
    }

    const userData = getFromStorage("userData", {});

    // Create payment intent with proper error handling
    const response = await fetch(
      "https://us-central1-mind-c3055.cloudfunctions.net/createPaymentIntent",
      {
        method: "POST",
        body: JSON.stringify({
          amount: amount * 100,
          userId: getFromStorage("createUserResponse", {}).userId,
          courseSlugs: getFromStorage("selectedCourses", []),
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to create payment intent");
    }

    // Check for client secret in different possible locations
    const clientSecret = data.paymentIntent;

    if (!clientSecret) {
      console.error("Payment Intent Response Structure:", data);
      throw new Error("No client secret received from payment intent");
    }

    // Create payment element
    const elements = stripe.elements({
      clientSecret,
      appearance: {
        theme: "stripe",
        variables: {
          colorPrimary: "#5469d4",
        },
      },
    });

    // Create and mount the Payment Element
    const paymentElement = elements.create("payment");

    // Remove any existing payment forms
    const popupWrap = document.querySelector("#payment_popup_wrapper");
    popupWrap.classList.add("active");
    popupWrap.style.display = "flex";

    // Create form for payment submission
    const form = document.querySelector(".payment_gateway_contain");   
    // Create submit button
    const submitButton = document.querySelector("#submit_payment");
    
    // Mount the Payment Element
    paymentElement.mount("#payment_element");

    // Handle form submission
    submitButton.addEventListener("click", async (event) => {
      event.preventDefault();
      submitButton.disabled = true;

      try {
        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: window.location.href.replace("onboarding", "vielen-dank"),
            payment_method_data: {
              billing_details: {
                name: `${userData.firstName} ${userData.lastName}`,
                email: userData.email,
                address: {
                  country: "DE",
                },
              },
            },
          },
        });

        if (error) {
          console.error("Payment failed:", error);
          // Show error to customer
          const errorDiv = document.createElement("div");
          errorDiv.style.color = "red";
          errorDiv.style.marginTop = "10px";
          errorDiv.textContent = error.message;
          form.appendChild(errorDiv);
        }
      } catch (error) {
        console.error("Payment error:", error);
      } finally {
        registerButton.textContent = "Pay now";
        // window.location.href = window.location.href.replace("onboarding", "vielen-dank");
        submitButton.disabled = false;
      }
    });
  } catch (error) {
    
    console.error("Error creating payment:", error);
    throw error;
  }
}

// Add this function to create the user
async function createUser() {
  try {
    const userData = getFromStorage("userData", {});
    const selectedCourses = getFromStorage("selectedCourses", []);
    const selectedHealthProvider = getFromStorage("selectedHealthProvider", "");
    const healthProviders = getFromStorage("healthProviders", {});
    const onboardingSurveyAnswers = getFromStorage(
      "onboardingSurveyAnswers",
      []
    );

    // Format the courses data
    const paidCourses = selectedCourses.map((course) => {
      const validTill = new Date();
      validTill.setFullYear(validTill.getFullYear() + 1);

      return {
        course: course.toUpperCase(),
        status: "valid",
        validTill: validTill.toISOString().split("T")[0],
      };
    });

    // Get health provider data
    const healthProviderData = healthProviders[selectedHealthProvider];

    // Check if user has any contraindications for their selected courses
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
        numberOfCourses: selectedCourses.length.toString(),
        takeover: healthProviderData.takeover || "",
      },
      paidCourses: paidCourses,
      selectedCourses: selectedCourses.map((course) => course.toUpperCase()),
      onboarding: {
        answers: {
          step1: selectedCourses.map((course) => course.toUpperCase()),
          step2: onboardingSurveyAnswers || [],
        },
      },
    };

    setToStorage("createUserPayload", payload);

    const response = await fetch(getCreateUserBaseUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    setToStorage("createUserResponse", data);
    setToStorage("userId", data.userId);

    if (!response.ok) {
      throw new Error(data.message || "Failed to create user");
    }

    return data;
  } catch (error) {
    setToStorage("createUserResponse", error);
    console.error("Error creating user:", error);
    throw error;
  }
}

function populateNamePrefix() {
  const namePrefixSelect = document.querySelector('select[name="namePrefix"]');
  const prefixes = ["Mr.", "Mrs."];
  // Clear existing options except the first placeholder
  while (namePrefixSelect.options.length > 1) {
    namePrefixSelect.remove(1);
  }
  // Add new options
  prefixes.forEach((prefix) => {
    const option = document.createElement("option");
    option.value = prefix;
    option.textContent = prefix;
    namePrefixSelect.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const steps = document.querySelectorAll(
    ".form_step_wrap .form_step, .form_step_popup"
  );
  const prevBtns = document.querySelectorAll("[data-btn-prev]");
  const nextBtns = document.querySelectorAll("[data-btn-next]");
  const submitBtn = document.querySelector("[data-btn-submit]");
  const errorMessageStep1 = document.getElementById("error_message_step1");
  const errorMessageStep2 = document.getElementById("error_message");
  const errorMessageStep3 = document.getElementById("error_message_step3");
  const errorMessageStep4 = document.getElementById("error_message_step4");
  const errorMessageStep5 = document.getElementById("error_message_step5");

  let currentStep = 0;

  function showStep(index) {
    steps.forEach((step) => {
      step.classList.remove("active");
      step.style.display = "none";
    });

    if (steps[index]) {
      steps[index].classList.add("active");
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

  // Modify isCurrentStepValid to properly return a Promise
  async function isCurrentStepValid() {
    let valid = true;
    let errorMessages = [];

    try {
      switch (currentStep) {
        case 0:
          const dropdown = document.getElementById("healthProviders");
          if (
            !dropdown ||
            dropdown.value.trim() === "" ||
            dropdown.value === null
          ) {
            valid = false;
            errorMessages.push("Please select an option from the dropdown.");
          }
          break;

        case 1:
          const checkboxesStep2 = document.querySelectorAll(
            ".card_select_checkbox:checked"
          );
          if (checkboxesStep2.length < 1 || checkboxesStep2.length > 2) {
            valid = false;
            errorMessages.push("Please select 1 or 2 options.");
          }
          break;

        case 2:
          const checkboxesStep3 = document.querySelectorAll(
            ".custom-checkbox-input:checked"
          );
          if (checkboxesStep3.length < 1 || checkboxesStep3.length > 2) {
            valid = false;
            errorMessages.push("Please select 1 or 2 options.");
          }
          break;

        case 4:
          const popupConsent1 = document.getElementById("popupConsent1");
          const popupConsent2 = document.getElementById("popupConsent2");
          if (!popupConsent1.checked || !popupConsent2.checked) {
            valid = false;
            errorMessages.push("Please agree to both terms before continuing.");
          }
          break;

        case 5:
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

          // Clear previous error states
          Object.values(fields).forEach((field) => {
            if (field) {
              field.classList.remove("error");
            }
          });

          // Validate and collect data
          const formData = {};
          Object.entries(fields).forEach(([key, field]) => {
            if (!field) {
              console.error(`Field ${key} not found`);
              valid = false;
              errorMessages.push(`${key} field is missing`);
              return;
            }

            const value = field.value.trim();
            formData[key] = value;

            if (!value) {
              field.classList.add("error");
              valid = false;
              errorMessages.push(`${key} is required`);
            }

            // Email validation
            if (key === "email" && value) {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value)) {
                field.classList.add("error");
                valid = false;
                errorMessages.push("Please enter a valid email address");
              }
            }

            // Password validation
            if (key === "password" && value) {
              if (value.length < 6) {
                field.classList.add("error");
                valid = false;
                errorMessages.push("Password must be at least 6 characters long");
              }
            }

            // Date of birth validation
            if (key === "dateOfBirth" && value) {
              const date = new Date(value);
              const today = new Date();
              const minAge = 18;
              const minDate = new Date();
              minDate.setFullYear(today.getFullYear() - minAge);

              if (isNaN(date.getTime()) || date > today || date > minDate) {
                field.classList.add("error");
                valid = false;
                errorMessages.push("You must be at least 18 years old");
              }
            }

            if (key === "consent1") {
              if (!field.checked) {
                field.classList.add("error");
                valid = false;
                errorMessages.push(
                  "Please agree to the consent before continuing."
                );
              }
            }

            if (key === "privacyPolicy") {
              if (!field.checked) {
                field.classList.add("error");
                valid = false;
                errorMessages.push(
                  "Please agree to the privacy policy before continuing."
                );
              }
            }
          });
          
          if (valid) {
            setToStorage("userData", formData);
            await createUser();
            await doPayment(calculateTotalPrice());
          }
          break;
      }

      // Show error messages if any
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
        // Hide all error messages if valid
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

  // Modify handleNextClick to properly handle the async validation
  async function handleNextClick(event) {
    console.log("handleNextClick");
    event.preventDefault();
    
    try {
      const isValid = await isCurrentStepValid();
      console.log("isValid", isValid);
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

  function handlePrevClick(event) {
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
  }

  attachEventListeners();
  showStep(currentStep);
});