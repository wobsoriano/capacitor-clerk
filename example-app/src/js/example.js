import { ClerkPlugin } from 'capacitor-clerk';

window.testEcho = () => {
    const inputValue = document.getElementById("echoInput").value;
    ClerkPlugin.echo({ value: inputValue })
}
