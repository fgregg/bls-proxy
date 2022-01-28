// We support the GET, POST, and OPTIONS methods from any origin,
// and allow any header on requests. These headers must be present
// on all responses to all CORS preflight requests. In practice, this means
// all responses to OPTIONS requests.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
}

// The URL for the remote third party API you want to fetch from
// but does not implement CORS
const API_HOST = "api.bls.gov"

// publicAPI/v2/timeseries/data/"

const PROXY_ENDPOINT = 'foo'

// The rest of this snippet for the demo page
function rawHtmlResponse(html) {
  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=UTF-8",
    },
  })
}

const DEMO_PAGE = `
  <!DOCTYPE html>
  <html>
  <body>
    <h1>API GET without CORS Proxy</h1>
    <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Checking_that_the_fetch_was_successful">Shows TypeError: Failed to fetch since CORS is misconfigured</a>
    <p id="noproxy-status"/>
    <code id="noproxy">Waiting</code>
    <h1>API GET with CORS Proxy</h1>
    <p id="proxy-status"/>
    <code id="proxy">Waiting</code>
    <h1>API POST with CORS Proxy + Preflight</h1>
    <p id="proxypreflight-status"/>
    <code id="proxypreflight">Waiting</code>
    <script>
    let reqs = {};
    reqs.noproxy = () => {
      return fetch("${API_HOST}").then(r => r.json())
    }
    reqs.proxy = async () => {
      let href = "${PROXY_ENDPOINT}?apiurl=${API_HOST}"
      return fetch(window.location.origin + href).then(r => r.json())
    }
    reqs.proxypreflight = async () => {
      let href = "${PROXY_ENDPOINT}?apiurl=${API_HOST}"
      let response = await fetch(window.location.origin + href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          msg: "Hello world!"
        })
      })
      return response.json()
    }
    (async () => {
      for (const [reqName, req] of Object.entries(reqs)) {
        try {
          let data = await req()
          document.getElementById(reqName).innerHTML = JSON.stringify(data)
        } catch (e) {
          document.getElementById(reqName).innerHTML = e
        }
      }
    })()
    </script>
  </body>
  </html>`

async function handleRequest(event) {

  let cache = caches.default
  let response = await cache.match(event.request)
    
  if (!response){
    response = await subRequest(event.request)
    
    if (response.ok) {
      response.headers.append('Cache-Control', 's-maxage=86400')
      event.waitUntil(cache.put(event.request, response.clone()))
    }
  }
  response = new Response(response.body, response)
  response.headers.append('Cache-Control', 'max-age=86400')
  
  return response
}

async function sha256(message) {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message)

  // hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)

  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer))

  // convert bytes to hex string
  const hashHex = hashArray.map(b => ("00" + b.toString(16)).slice(-2)).join("")
  return hashHex
}

async function handlePostRequest(event) {
  const request = event.request
  const body = await request.clone().text()

  // Hash the request body to use it as a part of the cache key
  const hash = await sha256(body)
  const cacheUrl = new URL(request.url)

  // Store the URL in cache by prepending the body's hash
  cacheUrl.pathname = "/posts" + cacheUrl.pathname + hash

  // Convert to a GET to be able to cache
  const cacheKey = cacheUrl.toString()

  const cache = caches.default

  // Find the cache key in the cache
  let response = await cache.match(cacheKey)
  // response = undefined

  // Otherwise, fetch response to POST request from origin
  if (!response) {
    response = await subRequest(request);
    response.headers.append("Cache-Control", "s-maxage=86400");
    let foobar = new Response(response.clone().body)
    await cache.put(cacheKey, foobar)
    let cache_test = await cache.match(cacheKey)
    console.log(cache_test)
    let test_response = new Response('bar')
    await cache.put('https://google.com', test_response)
    cache_test = await cache.match('https://google.com')
    console.log(cache_test)
    
    event.waitUntil(cache.put(cacheKey, response.clone()));
  }
  else {
    response = new Response(response.body, response)
    response.headers.set("Access-Control-Allow-Origin", '*')
    response.headers.append("Vary", "Origin")
  }
    
  return response
}



async function subRequest(request) {

  
  let apiUrl = new URL(request.url)
  apiUrl.host = API_HOST

  console.log('apiURL')
  console.log(apiUrl)

  // Rewrite request to point to API url. This also makes the request mutable
  // so we can add the correct Origin header to make the API server think
  // that this request isn't cross-site.
  const sub_request = new Request(apiUrl, request)
  sub_request.headers.set("Origin", new URL(apiUrl).origin)
  const sub_response = await fetch(sub_request)

  // Recreate the response so we can modify the headers
  const response = new Response(sub_response.body, sub_response)

  // Set CORS headers
  response.headers.set("Access-Control-Allow-Origin", '*')

  // Append to/Add Vary header so browser will cache response correctly
  response.headers.append("Vary", "Origin")
  response.headers.delete("cf-cache-status")

  response.url = request.url
  
  return response
}

function handleOptions(request) {
  // Make sure the necessary headers are present
  // for this to be a valid pre-flight request
  let headers = request.headers;
  if (
    headers.get("Origin") !== null &&
    headers.get("Access-Control-Request-Method") !== null &&
    headers.get("Access-Control-Request-Headers") !== null
  ){
    // Handle CORS pre-flight request.
    // If you want to check or reject the requested method + headers
    // you can do that here.
    let respHeaders = {
      ...corsHeaders,
    // Allow all future content Request headers to go back to browser
    // such as Authorization (Bearer) or X-Client-Name-Version
      "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers"),
    }

    return new Response(null, {
      headers: respHeaders,
    })
  }
  else {
    // Handle standard OPTIONS request.
    // If you want to allow other HTTP Methods, you can do that here.
    return new Response(null, {
      headers: {
        Allow: "GET, HEAD, POST, OPTIONS",
      },
    })
  }
}


addEventListener("fetch", event => {
  const request = event.request
  const url = new URL(request.url)
  if(url.pathname){
    if (request.method === "OPTIONS") {
      // Handle CORS preflight requests
      return event.respondWith(handleOptions(request))
    }
    else if(
      request.method === "GET"
    ){
      return event.respondWith(handleRequest(event))
    }
    else if(request.method === 'POST') {
     return  event.respondWith(handlePostRequest(event))
    }
    else {
      return event.respondWith(
        new Response(null, {
          status: 405,
          statusText: "Method Not Allowed",
        }),
      )
    }
  }
  else {
    // Serve demo page
    return event.respondWith(rawHtmlResponse(DEMO_PAGE))
  }
})
