import index_html from './index.html'
import makeCacheKey from './cache_key.js'

// We support the GET, POST, and OPTIONS methods from any origin,
// and allow any header on requests. These headers must be present
// on all responses to all CORS preflight requests. In practice, this means
// all responses to OPTIONS requests.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
}

// The rest of this snippet for the demo page
function rawHtmlResponse(html) {
  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=UTF-8",
    },
  })
}

async function handleRequest(request, context) {

  const cacheKey = await makeCacheKey(request)

  const cache = caches.default

  let response = await cache.match(cacheKey)

  if (!response) {
    response = await blsRequest(request);
    const response_to_cache = new Response(response.clone().body, response.clone())
    response_to_cache.headers.append("Cache-Control", "s-maxage=86400");
    response_to_cache.headers.delete('set-cookie');    
    context.waitUntil(cache.put(cacheKey, response_to_cache));
  }

  response = new Response(response.body, response)
  response.headers.set("Access-Control-Allow-Origin", '*')
  //Append to/Add Vary header so browser will cache response correctly
  response.headers.append("Vary", "Origin")

  if (request.method === 'GET') {
    response.headers.append('Cache-Control', 'max-age=86400')
  }
  
  return response
}


async function blsRequest(request) {

  
  let apiUrl = new URL(request.url)
  apiUrl.host = 'api.bls.gov'

  // Rewrite request to point to API url. This also makes the request mutable
  // so we can add the correct Origin header to make the API server think
  // that this request isn't cross-site.
  const sub_request = new Request(apiUrl, request)
  sub_request.headers.set("Origin", new URL(apiUrl).origin)
  return fetch(sub_request)
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
        Allow: "GET, POST, OPTIONS",
      },
    })
  }
}

export default {
async fetch(request, environment, context) {
  const url = new URL(request.url)
  if(url.pathname !== '/'){
    if (request.method === "OPTIONS") {
      // Handle CORS preflight requests
      return await handleOptions(request, context)
    }
    else if (request.method === "GET" ||
	     request.method === "POST")	{
      return await handleRequest(request, context)
    }
    else {
      return new Response(null, {
          status: 405,
          statusText: "Method Not Allowed",
      })
    }
  }
  else {
    // Serve demo page
    return await rawHtmlResponse(index_html)
  }
}
}
