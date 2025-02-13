function getDocumentFromFireBase(document) {
  // eslint-disable-next-line no-undef
  return `${API}/getConfigData?document=${document}`;
}

function getCreateUserBaseUrl() {
  // eslint-disable-next-line no-undef
  return `${API}/createUser`;
}


function getWebflowStory(slug) {
  // eslint-disable-next-line no-undef
  return `${API}/getWebflowStory?slug=${slug}&draft=true`;
}

const store = {};
window.store = store;

const CURRENCY = "€";

function initializeFormListeners() {
  const form = document.getElementById('signUpForm');
  const submitButton = document.getElementById('registerFormSubmitButton');
  
  // Remove existing event listeners if any
  if (form) {
    form.removeEventListener('submit', handleFormSubmission);
    form.addEventListener('submit', handleFormSubmission);
  }
  
  if (submitButton) {
    submitButton.removeEventListener('click', handleFormSubmission);
    submitButton.addEventListener('click', handleFormSubmission);
  }
}

function onboardingHook({steps, currrent, index}) {
  console.log({ currrentStep: currrent, index });
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
    initializeFormListeners(); // Initialize form listeners in step 5
    populateCheckout();
  }
}


async function fetchHealthProviders() {
  try {
    const response = await fetch(getDocumentFromFireBase("healthProviders"));
    const data = await response.json();

    if (data.success && Object.keys(data.data).length > 0) {
      window.store.healthProviders = data.data;
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
    store.selectedHealtProvider = selectedProvider;
    document.querySelector("#takeover").innerHTML =
      window.store.healthProviders[selectedProvider].takeover;
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
      window.store.pricing = data.data;
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
      window.store.contraindications = healthContraindications;
    }
  } catch (error) {
    console.error(error);
  }
}

function getFilteredContraindications() {
  const selectedCourses = window.store.selectedCourses;
  const contraindications = window.store.contraindications;
  return contraindications.filter((contraindication) =>
    selectedCourses.includes(contraindication.course_slug)
  );
}

async function populateCourses() {
  const res = await fetch(getDocumentFromFireBase("courses"));

  const data = await res.json();

  if (data.success && data.data["courses-info"].length) {
    window.store.courses = data.data["courses-info"];
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
  window.store.selectedCourses = selectedCourses;
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
  const selectedCourses = window.store.selectedCourses ?? [];
  const data = await res.json();
  const surveyData =
    data?.story?.content?.onboarding_survey_steps?.[1]?.answers;
  console.log(surveyData, selectedCourses);
  if (surveyData.length) {
    window.store.onboardingSurvey = surveyData;
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
  window.store.onboardingSurveyAnswers = surveyAnswers;
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
  const filteredCourses = window.store.courses.filter((course) =>
    window.store.selectedCourses.includes(course.slug)
  );
  filteredCourses.forEach((course) => {
    container.prepend(
      renderCardResult(
        "https://cdn.prod.website-files.com/676e8e3a573b707f2be07685/677d7fc464ea793a4794a3a2_image%20112.webp",
        course.name,
        course.recommendation_description,
        course.course_color
      )
    );
  });
  fillSummaryStepData();
}

function fillSummaryStepData() {
  const takeoverSummary = document.querySelector("#takeoverSummary");
  takeoverSummary.innerHTML =
    window.store.healthProviders[window.store.selectedHealtProvider].takeover;

  const price = document.querySelector("#price");

  if (window.store.selectedCourses.length === 1) {
    price.innerHTML = window.store.pricing.singleCoursePrice + CURRENCY;
  } else if (window.store.selectedCourses.length === 2) {
    price.innerHTML = window.store.pricing.twoCoursesPrice + CURRENCY;
  }

  const coursesCountElement = document.querySelector("#coursesCount");
  coursesCountElement.innerHTML = window.store.selectedCourses.length;
}



function populateContraindications() {
  const container = document.querySelector(".dropdown_padding");

  const filteredCourses = window.store.courses.filter((course) =>
    window.store.selectedCourses.includes(course.slug)
  );

  filteredCourses.forEach((course) => {
    const item = renderContraindicationItem(course.slug, course.name, window.store.contraindications.filter((contraindication) => contraindication.course_slug === course.slug));
    container.appendChild(item);
  });
}


function renderContraindicationItem(slug, name, contraindications) {
  const template = document.createElement("template");
  template.innerHTML = `
    <div class="dropdown_content">
      <div class="program_name">Programm: ${name}</div>
      <ul role="list" class="program_list">
        ${contraindications.map((contraindication) => `<li class="program_list_item">${contraindication.contraindication}</li>`).join("")}
      </ul>
    </div>`;
  return template.content.firstElementChild;
}


function populateCheckout() {
  const container = document.querySelector("#productList");
  const totalContainer = document.querySelector("#priceTotal");
  const filteredCourses = window.store.courses.filter((course) =>
    window.store.selectedCourses.includes(course.slug)
  );

  const priceOld = filteredCourses.length === 2 ? Number(window.store.pricing.singleCoursePrice) : "";
  const priceNew = filteredCourses.length === 2 ? Number(window.store.pricing.twoCoursesPrice) / 2 : window.store.pricing.singleCoursePrice; 

  filteredCourses.forEach((course) => {
    const item = renderCheckoutCourseItem( "https://cdn.prod.website-files.com/676e8e3a573b707f2be07685/677d7fc464ea793a4794a3a2_image%20112.webp", course.name, course.description, String(priceOld)+ priceOld ? CURRENCY : "", priceNew, course.slug, course.course_color);
    container.appendChild(item);
  });
  totalContainer.innerHTML = (Number(priceNew)*filteredCourses.length).toFixed(2)+CURRENCY;
}


function renderCheckoutCourseItem(imageSrc, title, description, priceOld, priceNew, badgeText, badgeColor) {
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


// Add this new function to handle form submission
function handleFormSubmission(event) {
  event.preventDefault();
  

  const submitButton = document.getElementById('registerFormSubmitButton');
  
  // Disable submit button to prevent double submission
  submitButton.disabled = true;
  
  // Get and validate form data
  const isValid = getFormData();
  
  if (!isValid) {
    submitButton.disabled = false;
    return;
  }
  
  
  // Call createUser with the form data from store
  createUser()
    .catch(error => {
      console.error('Error creating user:', error);
      // Handle error (show error message to user)
    })
    .finally(() => {
      submitButton.disabled = false;
    });
}

// Add this function to create the user
async function createUser() {
  try {
    const userData = window.store.userData;
    // Format the courses data
    const paidCourses = window.store.selectedCourses.map(course => {
      const validTill = new Date();
      validTill.setFullYear(validTill.getFullYear() + 1);
      
      return {
        course: course.toUpperCase(),
        status: "valid",
        validTill: validTill.toISOString().split('T')[0]
      };
    });

    // Get health provider data
    const healthProviderData = window.store.healthProviders[window.store.selectedHealtProvider];

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
        name: window.store.selectedHealtProvider,
        numberOfCourses: window.store.selectedCourses.length.toString(),
        takeover: healthProviderData.takeover || ""
      },
      paidCourses: paidCourses,
      selectedCourses: window.store.selectedCourses.map(course => course.toUpperCase()),
      onboarding: {
        answers: {
          step1: window.store.selectedCourses.map(course => course.toUpperCase()),
          step2: window.store.onboardingSurveyAnswers || [],
        }
      }
    };

    console.log(payload);
    
    const response = await fetch(getCreateUserBaseUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create user');
    }

    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}


function populateNamePrefix() {
  const namePrefixSelect = document.getElementById('namePrefix');
  const prefixes = ['Mr.', 'Mrs.'];
  console.log(namePrefixSelect, prefixes);
  // Clear existing options except the first placeholder
  while (namePrefixSelect.options.length > 1) {
    namePrefixSelect.remove(1);
  }

  // Add new options
  prefixes.forEach(prefix => {
    const option = document.createElement('option');
    option.value = prefix;
    option.textContent = prefix;
    namePrefixSelect.appendChild(option);
  });
}

function getFormData() {
  const form = document.getElementById('signUpForm');
  const formData = {};
  let isValid = true;

  // Get form fields
  const fields = {
    namePrefix: form.querySelector('select[id="namePrefix"]'),
    firstName: form.querySelector('input[id="firstName"]'),
    lastName: form.querySelector('input[id="lastName"]'),
    dateOfBirth: form.querySelector('input[id="dateOfBirth"]'),
    email: form.querySelector('input[id="email"]'),
    password: form.querySelector('input[name="password"]')
  };

  // Clear previous error states
  Object.values(fields).forEach(field => {
    if (field) {
      field.classList.remove('error');
    }
  });

  // Validate and collect data
  Object.entries(fields).forEach(([key, field]) => {
    if (!field) {
      console.error(`Field ${key} not found`);
      isValid = false;
      return;
    }

    const value = field.value.trim();
    formData[key] = value;

    if (!value) {
      field.classList.add('error');
      isValid = false;
    }

    // Email validation
    if (key === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        field.classList.add('error');
        isValid = false;
      }
    }

    // Password validation
    if (key === 'password' && value) {
      if (value.length < 6) { // minimum 6 characters
        field.classList.add('error');
        isValid = false;
      }
    }

    // Date of birth validation
    if (key === 'dateOfBirth' && value) {
      const date = new Date(value);
      const today = new Date();
      const minAge = 18;
      const minDate = new Date();
      minDate.setFullYear(today.getFullYear() - minAge);
      
      if (isNaN(date.getTime()) || date > today || date > minDate) {
        field.classList.add('error');
        isValid = false;
      }
    }
  });

  if (isValid) {
    window.store.userData = formData;
  }

  return isValid;
}


