// Renders the "Sign in with Google" button into element, loading Google's script once.
// callback receives the ID token (credential) after the user signs in.
export function renderGoogleButton(element, callback) {
  const render = () => {
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: (response) => callback(response.credential),
    })
    window.google.accounts.id.renderButton(element, {
      theme: 'outline',
      size: 'large',
      width: 320,
      locale: 'auto',
    })
  }

  if (window.google?.accounts) {
    render()
    return
  }
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.onload = render
  document.head.appendChild(script)
}
