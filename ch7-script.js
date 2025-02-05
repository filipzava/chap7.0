function getDocumentFromFireBase(document) {
  // eslint-disable-next-line no-undef
  return `${API}/getConfigData?document=${document}`;
}


function getWebflowStory(slug) {
  // eslint-disable-next-line no-undef
  return `${API}/getWebflowStory?slug=${slug}&draft=true`;
}

const store = {};
window.store = store;



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
    price.innerHTML = window.store.pricing.singleCoursePrice + "€";
  } else if (window.store.selectedCourses.length === 2) {
    price.innerHTML = window.store.pricing.twoCoursesPrice + "€";
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






