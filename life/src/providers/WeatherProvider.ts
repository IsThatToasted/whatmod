import type { WeatherData } from '../types'

export interface WeatherProvider { getCurrentWeather(): Promise<WeatherData | null>; getForecast(): Promise<WeatherData[]> }
export class DisabledWeatherProvider implements WeatherProvider { async getCurrentWeather(){return null}; async getForecast(){return []} }
export class DemoWeatherProvider implements WeatherProvider { async getCurrentWeather(){return {temperature:66,condition:'Partly cloudy',high:72,low:55}}; async getForecast(){return []} }
