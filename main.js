
const API_KEY = "727f37096a070429d67ae2f062ab937d";
const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

let selectedCityText;
let selectedCity;

const getCurrentWeatherData = async ({ lat, lon, name: city }) => {
    const url = lat && lon ? `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric` : `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`;
    const response = await fetch(url);
    return response.json();
}
const getCities = async (searchText) => {
    const response = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${searchText}&limit=5&appid=${API_KEY}`);
    return response.json();
}
const getHourlyForecast = async ({ name: city }) => {
    const resp = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEY}&units=metric`);
    const data = await resp.json();
    return data.list.map(forecast => {
        const { main: { temp, temp_max, temp_min }, dt, dt_txt, weather: [{ description, icon }] } = forecast;
        return { temp, temp_max, temp_min, dt, dt_txt, description, icon };
    })
}

const formatTemp = (temp) => `${temp?.toFixed(1)}°C`;
const getIconUrl = (icon) => `http://openweathermap.org/img/wn/${icon}@2x.png`;


function loadCurrentForecast({ name, main: { temp, temp_min, temp_max }, weather: [{ description }] }) {
    const currentForecastElement = document.querySelector("#current-forecast");
    currentForecastElement.querySelector(".city").textContent = name;
    currentForecastElement.querySelector(".temp").textContent = formatTemp(temp);
    currentForecastElement.querySelector(".description").textContent = description;
    currentForecastElement.querySelector(".min-max-temp").textContent = `H: ${formatTemp(temp_max)} L: ${formatTemp(temp_min)} `;
}

const loadHourlyForecast = ({ main: { temp: tempNow }, weather: [{ icon: iconNow }] }, hourlyForecast) => {
    let dataFor12Hours = hourlyForecast.slice(2, 13);
    const hourlyContainer = document.querySelector(".hourly-container");
    const timeFormatter = Intl.DateTimeFormat("en", { hour12: true, hour: "numeric" });
    let innerHTMLString = `<article>
    <h2 class="time">Now</h2>
    <img class="icon" src="${getIconUrl(iconNow)}" />
    <p class="hourly-temp">${formatTemp(tempNow)}</p>
    </article>`;

    for (let { temp, icon, dt_txt } of dataFor12Hours) {
        innerHTMLString += `<article>
        <h2 class="time">${timeFormatter.format(new Date(dt_txt))}</h2>
        <img class="icon" src="${getIconUrl(icon)}" />
        <p class="hourly-temp">${formatTemp(temp)}</p>
        </article>`;
    }

    hourlyContainer.innerHTML = innerHTMLString;
}
// -----------------------------------------------------------------------------------
const calculateDayWiseForecast = (hourlyForecast) => {
    let dayWiseForecast = new Map();
    for (let forecast of hourlyForecast) {
        const [date] = forecast.dt_txt.split(" ");
        const day = daysOfWeek[new Date(date).getDay()];
        if (dayWiseForecast.has(day)) {
            let forecastForTheDay = dayWiseForecast.get(day);
            forecastForTheDay.push(forecast);
            dayWiseForecast.set(day, forecastForTheDay);

        } else {
            dayWiseForecast.set(day, [forecast]);
        }
    }
    for (let [key, value] of dayWiseForecast) {
        let temp_min = Math.min(...Array.from(value, val => val.temp_min))
        let temp_max = Math.max(...Array.from(value, val => val.temp_max))
        dayWiseForecast.set(key, { temp_min, temp_max, icon: value.find(v => v.icon).icon })
    }
    return dayWiseForecast;
}

const loadFiveDayForecast = (hourlyForecast) => {
    const dayWiseForecast = calculateDayWiseForecast(hourlyForecast);
    const container = document.querySelector(".five-day-forecast-container");
    let dayWiseInfo = "";

    Array.from(dayWiseForecast).map(([date, { temp_min, temp_max, icon }], index) => {
        if (index < 5) {
            dayWiseInfo += `<article class="day-wise-forecast">
            <h3 class="day">${index === 0 ? "today" : date}</h3>
            <img class="icon" src="${getIconUrl(icon)}" alt="" />
            <p class="min-temp">${formatTemp(temp_min)}</p>
            <p class="max-temp">${formatTemp(temp_max)}</p>
          </article>`;
        }
    });

    container.innerHTML = dayWiseInfo;
};


// ------------------------------------------------------------------------------------

const loadFeelsLike = ({ main: { feels_like } }) => {
    let container = document.querySelector("#feels-like");
    container.querySelector(".feels-like-temp").textContent = formatTemp(feels_like);
}

const loadHumidity = ({ main: { humidity } }) => {
    let container = document.querySelector("#humidity");
    container.querySelector(".humidity-val").textContent = `${humidity}%`;
}

const loadForecastUsingGeoLoc = () => {
    navigator.geolocation.getCurrentPosition(({ coords }) => {
        const { latitude: lat, longitude: lon } = coords;
        selectedCity = { lat, lon };
        loadData();
    }, error => console.error(error));
}

const loadData = async () => {
    const weatherData = await getCurrentWeatherData(selectedCity);
    loadCurrentForecast(weatherData);
    const hourlyForecast = await getHourlyForecast(weatherData);
    loadHourlyForecast(weatherData, hourlyForecast);
    loadFiveDayForecast(hourlyForecast);
    loadFeelsLike(weatherData);
    loadHumidity(weatherData);
}

function debounce(func) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func.apply(this, args)
        }, 500);
    }
}

const onSearchChange = async (event) => {
    let { value } = event.target;
    if (!value) {
        selectedCity = null;
        selectedCityText = "";
    }
    if (value && (selectedCityText !== value)) {
        const cities = await getCities(value);
        // console.log(cities);
        let options = "";
        for (let { lat, lon, name, state, country } of cities) {
            options += `<option data-city-details='${JSON.stringify({ lat, lon, name })}' value="${name}, ${state}, ${country}"></option >`;
        }
        document.querySelector("#cities").innerHTML = options;
    }

}

const handleCitySelection = (event) => {
    selectedCityText = event.target.value;
    let options = document.querySelectorAll("#cities > option");
    if (options?.length) {
        let selectedOption = Array.from(options).find(opt => opt.value === selectedCityText);
        // console.log(selectedOption);
        selectedCity = JSON.parse(selectedOption.getAttribute("data-city-details"));
        // console.log({ selectedCity });
        loadData();
    }
}

const debounceSearch = debounce((event) => onSearchChange(event));

document.addEventListener("DOMContentLoaded", async () => {
    loadForecastUsingGeoLoc();
    const searchInput = document.querySelector("#search");
    searchInput.addEventListener("input", debounceSearch);
    searchInput.addEventListener("change", handleCitySelection);
});