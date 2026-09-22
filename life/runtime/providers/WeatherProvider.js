export class DisabledWeatherProvider {
    async getCurrentWeather() { return null; }
    ;
    async getForecast() { return []; }
}
export class DemoWeatherProvider {
    async getCurrentWeather() { return { temperature: 66, condition: 'Partly cloudy', high: 72, low: 55 }; }
    ;
    async getForecast() { return []; }
}
