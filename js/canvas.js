function drawSynastryCard(canvas, couple) {
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const gradient = context.createRadialGradient(width * .2, height * .18, 30, width * .66, height * .64, height * .82);
  gradient.addColorStop(0, '#5d173f');
  gradient.addColorStop(.38, '#220d2d');
  gradient.addColorStop(1, '#09050d');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  for (let i = 0; i < 90; i += 1) {
    const x = (Math.sin(i * 97.13) + 1) * width / 2;
    const y = (Math.cos(i * 41.77) + 1) * height / 2;
    const radius = i % 7 === 0 ? 3 : 1.2;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = i % 5 === 0 ? '#ff9eb0' : 'rgba(248,245,238,.72)';
    context.fill();
  }

  context.strokeStyle = 'rgba(255,77,109,.35)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(width / 2, height * .47, width * .32, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(width / 2, height * .47, width * .2, 0, Math.PI * 2);
  context.stroke();

  context.textAlign = 'center';
  context.fillStyle = '#ff4d6d';
  context.font = '700 22px Arial, sans-serif';
  context.letterSpacing = '4px';
  context.fillText('KALI ORÁCULO', width / 2, 120);
  context.fillStyle = '#f8f5ee';
  context.font = '600 72px Georgia, serif';
  context.fillText(couple.nameOne, width / 2, height * .39);
  context.fillStyle = '#ff4d6d';
  context.font = 'italic 46px Georgia, serif';
  context.fillText('&', width / 2, height * .46);
  context.fillStyle = '#f8f5ee';
  context.font = '600 72px Georgia, serif';
  context.fillText(couple.nameTwo, width / 2, height * .54);
  context.fillStyle = '#ff9eb0';
  context.font = '700 20px Arial, sans-serif';
  context.fillText(`${couple.elementOne}  ×  ${couple.elementTwo}`, width / 2, height * .7);
  context.fillStyle = '#f8f5ee';
  context.font = 'italic 32px Georgia, serif';
  context.fillText(couple.mysticalPhrase || 'Dos cielos. Una órbita.', width / 2, height * .81);
  context.fillStyle = 'rgba(248,245,238,.62)';
  context.font = '15px Arial, sans-serif';
  context.fillText('SINASTRÍA COSMOBIOLÓGICA · 2026', width / 2, height - 100);
}
