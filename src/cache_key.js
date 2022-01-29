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

async function makeCacheKey(request) {

  if (request.method === 'GET') {
    return request
  } else if (request.method === 'POST') {

    const body = await request.clone().text()

    const hash = await sha256(body)
    const cacheUrl = new URL(request.url)

    cacheUrl.pathname = "/posts" + cacheUrl.pathname + hash

    return cacheUrl.toString()
  } else {
    throw `Don't know how to make a cache key for a ${request.method} request`
  }
}

export {makeCacheKey as default};
