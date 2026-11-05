---
name: clima-local
description: Obtiene el clima actual y el pronóstico de la ubicación local del usuario (o de una ciudad indicada) usando wttr.in / Open-Meteo, sin API key. Úsala cuando el usuario pregunte por el clima, la temperatura, si va a llover, el pronóstico o diga "clima local".
---

# Clima local

Consulta el clima sin API key y responde en español, de forma breve.

## Pasos

1. **Ubicación**: si el usuario indicó una ciudad, úsala. Si no, deja que el servicio detecte la ubicación por IP (consulta vacía).
2. **Consulta** con `curl` (timeout corto, silencioso):

   ```bash
   # Ubicación automática por IP
   curl -s --max-time 10 "https://wttr.in/?format=j1&lang=es"

   # Ciudad específica (reemplaza espacios por +)
   curl -s --max-time 10 "https://wttr.in/Ciudad+de+Mexico?format=j1&lang=es"
   ```

   Campos útiles del JSON:
   - `current_condition[0]`: `temp_C`, `FeelsLikeC`, `humidity`, `windspeedKmph`, `winddir16Point`, `precipMM`, `uvIndex`, `lang_es[0].value` (descripción).
   - `nearest_area[0]`: `areaName[0].value`, `country[0].value` (confirma la ubicación detectada).
   - `weather[0..2]`: `date`, `maxtempC`, `mintempC`, `hourly[].chanceofrain`.

   Para una vista rápida en una línea: `curl -s --max-time 10 "https://wttr.in/?format=%l:+%c+%t+(sensación+%f)+💧%h+💨%w&lang=es"`

3. **Fallback** si wttr.in falla o no responde: Open-Meteo (requiere latitud/longitud; obténlas con su geocoding):

   ```bash
   curl -s --max-time 10 "https://geocoding-api.open-meteo.com/v1/search?name=Bogota&count=1&language=es"
   curl -s --max-time 10 "https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto"
   ```

4. **Responde** con este formato (español, conciso):

   ```
   📍 <Ciudad, País>
   🌡️ <temp>°C (sensación <fl>°C) — <descripción>
   💧 Humedad <h>% · 💨 Viento <v> km/h <dir> · 🌧️ Lluvia <mm> mm
   Próximos días: hoy <min>–<max>°C, mañana <min>–<max>°C, pasado <min>–<max>°C
   ```

   Añade una recomendación corta solo si aplica (paraguas si `chanceofrain` alto, protector solar si `uvIndex` ≥ 6).

## Notas

- La detección por IP es aproximada; si la ciudad devuelta no parece correcta, dilo y ofrece consultar otra.
- Usa unidades métricas (°C, km/h, mm).
- Si no hay red o ambos servicios fallan, informa el error tal cual; no inventes datos.
- Las consultas envían la ciudad (o la IP) a wttr.in/Open-Meteo; no incluyas datos personales en la consulta.
