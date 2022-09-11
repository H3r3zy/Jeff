
// TODO:
// - bevel filter
// - gradient glow filter
// - convolution filter
// - gradient bevel filter

exports.colorMatrix = function (context, params, dim, bounds) {
	/* jslint maxstatements: 50 */
	var left   = Math.max(dim.left, bounds.left);
	var top    = Math.max(dim.top,  bounds.top);
	var right  = Math.min(left + dim.width,  bounds.right);
	var bottom = Math.min(top  + dim.height, bounds.bottom);
	var width  = right - left;
	var height = bottom - top;

	if (width <= 0 || height <= 0) {
		return;
	}

	var pixelBuffer = context.getImageData(left, top, width, height);
	var pixelData   = pixelBuffer.data;
	var nBytes      = pixelData.length;
	var colorMatrix = params.matrix;

	var r0 = colorMatrix[0];
	var r1 = colorMatrix[1];
	var r2 = colorMatrix[2];
	var r3 = colorMatrix[3];
	var r4 = colorMatrix[4];

	var g0 = colorMatrix[5];
	var g1 = colorMatrix[6];
	var g2 = colorMatrix[7];
	var g3 = colorMatrix[8];
	var g4 = colorMatrix[9];

	var b0 = colorMatrix[10];
	var b1 = colorMatrix[11];
	var b2 = colorMatrix[12];
	var b3 = colorMatrix[13];
	var b4 = colorMatrix[14];

	var a0 = colorMatrix[15];
	var a1 = colorMatrix[16];
	var a2 = colorMatrix[17];
	var a3 = colorMatrix[18];
	var a4 = colorMatrix[19];

	for (var i = 0; i < nBytes; i += 4) {
		var r = pixelData[i];
		var g = pixelData[i + 1];
		var b = pixelData[i + 2];
		var a = pixelData[i + 3];

		pixelData[i]     = r * r0 + g * r1 + b * r2 + a * r3 + r4; // red
		pixelData[i + 1] = r * g0 + g * g1 + b * g2 + a * g3 + g4; // green
		pixelData[i + 2] = r * b0 + g * b1 + b * b2 + a * b3 + b4; // blue
		pixelData[i + 3] = r * a0 + g * a1 + b * a2 + a * a3 + a4; // blue
	}

	context.putImageData(pixelBuffer, left, top);
};

function blendNormal(srcData, dstData) {
// var test = true;
	var nBytes = srcData.length;
	for (var i = 0; i < nBytes; i += 4) {
		var da = dstData[i + 3] / 255;
		var sa = srcData[i + 3] / 255;

		var dr = dstData[i];
		var dg = dstData[i + 1];
		var db = dstData[i + 2];

		var sr = srcData[i];
		var sg = srcData[i + 1];
		var sb = srcData[i + 2];

		var sz = (1 - sa);
		var dz = (1 - da);

		// To anyone who reads this comment
		// if you know why this code works when raising to the power 4
		// let me know at bchevalier@wizcorp.jp
		var r = da + dz * Math.pow(da / (sa + da), 4);

		dstData[i]     = (dr * sz + sa * sr) * r + (1 - r) * sr;
		dstData[i + 1] = (dg * sz + sa * sg) * r + (1 - r) * sg;
		dstData[i + 2] = (db * sz + sa * sb) * r + (1 - r) * sb;
		dstData[i + 3] = (sa + da - sa * da) * 255;

		// if (test && sa > 0.1 && sa < 0.5) {
		// 	console.log('found!', dr, dg, db, da, r);
		// 	console.log('src!', sr, sg, sb, sa);
		// 	console.log('res!', dstData[i + 0], dstData[i + 1], dstData[i + 2], dstData[i + 3]);
		// 	test = false;
		// }
	}

	return dstData;
}

function knockoutUnder(srcData, dstData) {
	var nBytes = srcData.length;
	for (var i = 0; i < nBytes; i += 4) {
		srcData[i + 3] *= (1 - dstData[i + 3] / 255);
	}
	return srcData;
}

function knockoutInner(srcData, dstData) {
	var nBytes = srcData.length;
	for (var i = 0; i < nBytes; i += 4) {
		srcData[i + 3] *= dstData[i + 3] / 255;
	}
	return srcData;
}

function blendInner(srcData, dstData) {
	var nBytes = srcData.length;
	for (var i = 0; i < nBytes; i += 4) {
		var da = dstData[i + 3] / 255;
		var sa = srcData[i + 3] / 255;

		var dr = dstData[i];
		var dg = dstData[i + 1];
		var db = dstData[i + 2];

		var sr = srcData[i];
		var sg = srcData[i + 1];
		var sb = srcData[i + 2];

		var sz = (1 - sa);
		var dz = (1 - da);

		var r = 1 - Math.pow(sa, 4);

		srcData[i]     = (dr * sz + sa * sr) * r + (1 - r) * sr;
		srcData[i + 1] = (dg * sz + sa * sg) * r + (1 - r) * sg;
		srcData[i + 2] = (db * sz + sa * sb) * r + (1 - r) * sb;
		srcData[i + 3] = da * 255;
		// dstData[i + 3] = (sa + da - sa * da) * 255;
	}
	return srcData;
}

function blend(source, destination, inner, knockout, onTop, hideDestination) {
	var srcData = source.data;
	var dstData = destination.data;
	if (inner) {
		if (knockout) {
			return knockoutInner(srcData, dstData);
		} else {
			return blendInner(srcData, dstData);
		}
	}

	if (onTop) {
		if (knockout) {
			return srcData;
		} else {
			return blendNormal(srcData, dstData);
		}
	}

	if (knockout) {
		return knockoutUnder(srcData, dstData);
	} else {
		if (hideDestination) {
			return srcData;
		} else {
			return blendNormal(dstData, srcData);
		}
	}
}

function blurAlphaHorizontal(pixelsIn, pixelsOut, radius1, w, h) {
	radius1 /= 2;
	var radius2 = radius1 + 1;
	var blurCoeff = 1 / (radius1 + radius2);

	for (var y = 0; y < h; y += 1) {
		var a = 0;
		var i1 = y * w * 4;
		var i2 = i1;
		var i3 = i1;

		for (var x = 0; x < radius2; x += 1) {
			a  += pixelsIn[i2 + 3];
			i2 += 4;
		}

		for (x = 0; x < radius1; x += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			if (x + radius2 < w) {
		    	a  += pixelsIn[i2 + 3];
		    	i2 += 4;
			}
			i3 += 4;
		}

		for (x = radius1; x + radius2 < w; x += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			a  += pixelsIn[i2 + 3] - pixelsIn[i1 + 3];
			i1 += 4;
			i2 += 4;
			i3 += 4;
		}

		for (x = w - radius2; x < w; x += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			a  -= pixelsIn[i1 + 3];
			i1 += 4;
			i3 += 4;
		}
	}
}

function blurAlphaVertical(pixelsIn, pixelsOut, radius1, w, h) {
	radius1 /= 2;
	var radius2 = radius1 + 1;
	var blurCoeff = 1 / (radius1 + radius2);
	var offset = 4 * w;
	for (var x = 0; x < w; x += 1) {
		var a = 0;
		var i1 = 4 * x;
		var i2 = i1;
		var i3 = i1;

		for (var y = 0; y < radius2; y += 1) {
			a  += pixelsIn[i2 + 3];
			i2 += offset;
		}

		for (y = 0; y < radius1; y += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			if (y + radius2 < h) {
		    	a  += pixelsIn[i2 + 3];
		    	i2 += offset;
			}
			i3 += offset;
		}

		for (y = radius1; y + radius2 < h; y += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			a  += pixelsIn[i2 + 3] - pixelsIn[i1 + 3];
			i1 += offset;
			i2 += offset;
			i3 += offset;
		}

		for (y = h - radius2; y < h; y += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			a  -= pixelsIn[i1 + 3];
			i1 += offset;
			i3 += offset;
		}
	}
}

function glow(context, params, dim, bounds, color, angle, distance, gradientColors, gradientRatios) {
	/* jshint maxstatements: 100 */
	/* jshint maxdepth: 10 */
	var left   = dim.left;
	var top    = dim.top;
	var right  = left + dim.width;
	var bottom = top + dim.height;

	var inner = params.inner;

	var blurX = params.blurX * dim.ratio;
	var blurY = params.blurY * dim.ratio;
	var nbPasses  = params.numPasses;

	var dx = Math.round(Math.cos(angle) * distance);
	var dy = Math.round(Math.sin(angle) * distance);

	// Determining bounds for the blur
	var blurLeft   = Math.max(0,             Math.min(left,   left   + Math.min(dx, 0) - blurX * nbPasses));
	var blurRight  = Math.min(bounds.right,  Math.max(right,  right  + Math.max(dx, 0) + blurX * nbPasses));
	var blurTop    = Math.max(0,             Math.min(top,    top    + Math.min(dy, 0) - blurY * nbPasses));
	var blurBottom = Math.min(bounds.bottom, Math.max(bottom, bottom + Math.max(dy, 0) + blurY * nbPasses));

	// var blurLeft   = Math.max(0,             Math.round(Math.min(left,   left   - Math.abs(dx) - blurX)));
	// var blurRight  = Math.min(bounds.right,  Math.round(Math.max(right,  right  + Math.abs(dx) + blurX)));
	// var blurTop    = Math.max(0,             Math.round(Math.min(top,    top    - Math.abs(dy) - blurY)));
	// var blurBottom = Math.min(bounds.bottom, Math.round(Math.max(bottom, bottom + Math.abs(dy) + blurY)));

	var w = blurRight - blurLeft;
	var h = blurBottom - blurTop;

	if (w <= 0 || h <= 0) {
		return;
	}

	// var offsetIdx = (Math.round(dy * w) + Math.round(dx)) * 4;
	//      k = (y0 * w + x0) * 4 - offsetIdx;

	// Constructing blur
	var blurBuffer = context.createImageData(w, h);
	var glowBuffer = context.getImageData(blurLeft, blurTop, w, h);

	var glowData  = glowBuffer.data;
	var i, nBytes = glowData.length;

	if (distance > 0) {
		// shifting every pixel
		var xStart, xEnd1, xEnd2, xStep;
		if (dx < 0) {
			xStart = 0;
			xEnd1  = dx + w - 1;
			xEnd2  = w - 1;
			xStep  = 1;
		} else {
			xStart = w - 1;
			xEnd1  = dx - 1;
			xEnd2  = -1;
			xStep  = -1;
		}

		var yStart, yEnd1, yEnd2, yStep;
		if (dy < 0) {
			yStart = 0;
			yEnd1  = dy + h - 1;
			yEnd2  = h - 1;
			yStep  = 1;
		} else {
			yStart = h - 1;
			yEnd1  = dy - 1;
			yEnd2  = -1;
			yStep  = -1;
		}

		var x, y, k;
		for (x = xStart; x !== xEnd1; x += xStep) {
			for (y = yStart; y !== yEnd1; y += yStep) {
				// only shifting alpha values
				k = 4 * (y * w + x) + 3;
				glowData[k] = glowData[k - 4 * (dy * w + dx)];
			}

			// Setting alpha values to 0 for every pixel whose offset is out of bounds
			for (y = yEnd1; y !== yEnd2; y += yStep) {
				glowData[4 * (y * w + x) + 3] = 0;
			}
		}

		// Setting alpha values to 0 for every pixel whose offset is out of bounds
		for (y = yStart; y !== yEnd2; y += yStep) {
			for (x = xEnd1; x !== xEnd2; x += xStep) {
				glowData[4 * (y * w + x) + 3] = 0;
			}
		}
	}

	if (inner) {
		// inverting image alpha
		for (i = 0; i < nBytes; i += 4) {
			glowData[i + 3] = 255 - glowData[i + 3];
		}
	}

	for (var p = 0; p < nbPasses; p += 1) {
		if (blurX > 0) blurAlphaHorizontal(glowBuffer.data, blurBuffer.data, blurX, w, h);
		if (blurY > 0) blurAlphaVertical(blurBuffer.data, glowBuffer.data, blurY, w, h);
	}

	// context.putImageData(glowBuffer, blurLeft, blurTop);

	// Drawing bounding box (debugging purpose)
	// context.setTransform(1, 0, 0, 1, 0, 0);
	// context.globalAlpha = 1;
	// context.lineWidth   = 2;
	// context.strokeStyle = '#cc3333';
	// context.strokeRect(blurLeft, blurTop, w, h);
	// return;

	var r, g, b, a;
	if (gradientColors) {
		// if gradient, use a dummy color to make the first glow pass
		r = 255;
		g = 255;
		b = 255;
		a = 1;
	} else {
		r = color.red;
		g = color.green;
		b = color.blue;
		a = color.alpha;
	}

	// Applying colors
	var strength = params.strength;
	for (i = 0; i < nBytes; i += 4) {
		glowData[i]     = r;
		glowData[i + 1] = g;
		glowData[i + 2] = b;
		glowData[i + 3] = a * Math.min(Math.floor(strength * glowData[i + 3]), 255);
	}

	var dstBuffer = context.getImageData(blurLeft, blurTop, w, h);
	var dstPixels = dstBuffer.data;

	var pixelData = blend(glowBuffer, dstBuffer, inner, params.knockout, false, !params.compositeSource);
	var tmpBuffer = context.createImageData(w, h);
	var tmpData   = tmpBuffer.data;
	if (gradientColors) {
		var maxGradient = 256;
		var gradients = new Array(maxGradient);
		var tier = 0;
		var lastTier = gradientColors.length - 1;
		for (var g = 0; g < maxGradient; g += 1) {
			var r = 255 * g / maxGradient;
			while (gradientRatios[tier] < r && tier < lastTier) {
				tier += 1;
			}

			var ratioB = gradientRatios[tier];
			var ratioA = (tier === 0) ? ratioB : gradientRatios[tier - 1];
			var denominator = (ratioB - ratioA) || 1;
			var ratio = (r - ratioA) / denominator;
			if (ratio < 0) {
				ratio = 0;
			} else if (ratio > 1) {
				ratio = 1;
			}

			var colorB = gradientColors[tier];
			var colorA = (tier === 0) ? colorB : gradientColors[tier - 1];
			gradients[g] = [
				Math.round(colorA.red   * (1 - ratio) + colorB.red   * ratio),
				Math.round(colorA.green * (1 - ratio) + colorB.green * ratio),
				Math.round(colorA.blue  * (1 - ratio) + colorB.blue  * ratio),
				(colorA.alpha * (1 - ratio) + colorB.alpha * ratio) * 255
			];
		}

		var lastGradient = maxGradient - 1;
		var gradientCoeff = lastGradient / 255;
		for (i = 0; i < nBytes; i += 4) {
			var c = dstPixels[i + 3] / 255;
			var a = pixelData[i + 3];
			var color = gradients[Math.min(Math.floor(gradientCoeff * a), lastGradient)];
			tmpData[i]     = (1 - c) * color[0] + c * pixelData[i];
			tmpData[i + 1] = (1 - c) * color[1] + c * pixelData[i + 1];
			tmpData[i + 2] = (1 - c) * color[2] + c * pixelData[i + 2];
			tmpData[i + 3] = (1 - c) * color[3] + c * a;
		}
	} else {
		// Rewriting the content of the buffer
		// N.B should be unnecessary but there must be a bug somewhere
		// as using putImageData on dstBuffer directly does not work

		// THIS SHOULD WORK
		// dstBuffer.data = pixelData;
		// context.putImageData(dstBuffer, blurLeft, blurTop);

		// DOING THIS INSTEAD
		for (i = 0; i < nBytes; i += 4) {
			tmpData[i]     = pixelData[i];
			tmpData[i + 1] = pixelData[i + 1];
			tmpData[i + 2] = pixelData[i + 2];
			tmpData[i + 3] = pixelData[i + 3];
		}
	}

	context.putImageData(tmpBuffer, blurLeft, blurTop);


	// Updating dimension of the image
	dim.left   = blurLeft;
	dim.top    = blurTop;
	dim.right  = blurRight;
	dim.bottom = blurBottom;
	dim.width  = w;
	dim.height = h;
}

exports.dropShadow = function (context, params, dim, bounds) {
	glow(context, params, dim, bounds, params.dropShadowColor, params.angle, params.distance);
};

exports.glow = function (context, params, dim, bounds) {
	glow(context, params, dim, bounds, params.glowColor, 0, 0, params.gradientColors, params.gradientRatios);
};

function blurVertical(pixelsIn, pixelsOut, radius1, w, h) {
	var radius2 = radius1 + 1;
	var blurCoeff = 1 / (radius1 + radius2);
	for (var y = 0; y < h; y += 1) {
		var r = 0;
		var g = 0;
		var b = 0;
		var a = 0;
		var i1 = y * w * 4;
		var i2 = i1;
		var i3 = i1;
		var alpha;

		for (var x = 0; x < radius2; x += 1) {
			alpha = pixelsIn[i2 + 3];
			r += pixelsIn[i2]     * alpha;
			g += pixelsIn[i2 + 1] * alpha;
			b += pixelsIn[i2 + 2] * alpha;
			a += alpha;
			i2 += 4;
		}

		for (x = 0; x < radius1; x += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			if (x + radius2 < w) {
				alpha = pixelsIn[i2 + 3];
		    	r += pixelsIn[i2]     * alpha;
		    	g += pixelsIn[i2 + 1] * alpha;
		    	b += pixelsIn[i2 + 2] * alpha;
		    	a += alpha;
		    	i2 += 4;
			}
			i3 += 4;
		}

		for (x = radius1; x + radius2 < w; x += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			alpha = pixelsIn[i2 + 3];
			r += pixelsIn[i2]     * alpha;
			g += pixelsIn[i2 + 1] * alpha;
			b += pixelsIn[i2 + 2] * alpha;
			a += alpha;
			alpha = pixelsIn[i1 + 3];
			r -= pixelsIn[i1]     * alpha;
			g -= pixelsIn[i1 + 1] * alpha;
			b -= pixelsIn[i1 + 2] * alpha;
			a -= alpha;
			i1 += 4;
			i2 += 4;
			i3 += 4;
		}

		for (x = w - radius2; x < w; x += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			alpha = pixelsIn[i1 + 3];
			r -= pixelsIn[i1]     * alpha;
			g -= pixelsIn[i1 + 1] * alpha;
			b -= pixelsIn[i1 + 2] * alpha;
			a -= alpha;
			i1 += 4;
			i3 += 4;
		}
	}
}

function blurHorizontal(pixelsIn, pixelsOut, radius1, w, h) {
	var radius2 = radius1 + 1;
	var blurCoeff = 1 / (radius1 + radius2);
	var offset = 4 * w;
	for (var x = 0; x < w; x += 1) {
		var r = 0;
		var g = 0;
		var b = 0;
		var a = 0;
		var i1 = 4 * x;
		var i2 = i1;
		var i3 = i1;
		var alpha;

		for (var y = 0; y < radius2; y += 1) {
			alpha = pixelsIn[i2 + 3];
			r += pixelsIn[i2]     * alpha;
			g += pixelsIn[i2 + 1] * alpha;
			b += pixelsIn[i2 + 2] * alpha;
			a += alpha;
			i2 += offset;
		}

		for (y = 0; y < radius1; y += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			if (y + radius2 < h) {
				alpha = pixelsIn[i2 + 3];
		    	r += pixelsIn[i2]     * alpha;
		    	g += pixelsIn[i2 + 1] * alpha;
		    	b += pixelsIn[i2 + 2] * alpha;
		    	a += alpha;
		    	i2 += offset;
			}
			i3 += offset;
		}

		for (y = radius1; y + radius2 < h; y += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			alpha = pixelsIn[i2 + 3];
			r += pixelsIn[i2]     * alpha;
			g += pixelsIn[i2 + 1] * alpha;
			b += pixelsIn[i2 + 2] * alpha;
			a += alpha;
			alpha = pixelsIn[i1 + 3];
			r -= pixelsIn[i1]     * alpha;
			g -= pixelsIn[i1 + 1] * alpha;
			b -= pixelsIn[i1 + 2] * alpha;
			a -= alpha;
			i1 += offset;
			i2 += offset;
			i3 += offset;
		}

		for (y = h - radius2; y < h; y += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			alpha = pixelsIn[i1 + 3];
			r -= pixelsIn[i1]     * alpha;
			g -= pixelsIn[i1 + 1] * alpha;
			b -= pixelsIn[i1 + 2] * alpha;
			a -= alpha;
			i1 += offset;
			i3 += offset;
		}
	}
}

exports.blur = function (context, params, dim, bounds) {
	/* jshint maxstatements: 100 */
	/* jshint maxdepth: 10 */
	var left = dim.left;
	var top = dim.top;
	var right = left + dim.width;
	var bottom = top + dim.height;

	var blurX = params.blurX * (dim.ratio / 4);
	var blurY = params.blurY * (dim.ratio / 4);
	var nbPasses = params.numPasses;

	if (blurX === 0 && blurY === 0) {
		return;
	}

	// Determining bounds for the blur
	var blurLeft   = Math.max(0,             Math.round(Math.min(left,   left   - blurX * nbPasses)));
	var blurRight  = Math.min(bounds.right,  Math.round(Math.max(right,  right  + blurX * nbPasses)));
	var blurTop    = Math.max(0,             Math.round(Math.min(top,    top    - blurY * nbPasses)));
	var blurBottom = Math.min(bounds.bottom, Math.round(Math.max(bottom, bottom + blurY * nbPasses)));

	var w = blurRight - blurLeft;
	var h = blurBottom - blurTop;

	if (w <= 0 || h <= 0) {
		return;
	}

	// Constructing blur
	var blurBuffer1 = context.createImageData(w, h);
	var blurBuffer2 = context.getImageData(blurLeft, blurTop, w, h);
	for (var p = 0; p < nbPasses; p += 1) {
		if (blurX > 0) blurVertical(blurBuffer2.data, blurBuffer1.data, blurX, w, h);
		if (blurY > 0) blurHorizontal(blurBuffer1.data, blurBuffer2.data, blurY, w, h);
	}

	context.putImageData(blurBuffer2, blurLeft, blurTop);

	// Updating dimension of the image
	dim.left   = blurLeft;
	dim.top    = blurTop;
	dim.right  = blurRight;
	dim.bottom = blurBottom;
	dim.width  = w;
	dim.height = h;
};

exports.bevel = function (context, params, dim, bounds) {
	/* jshint maxstatements: 100 */
	/* jshint maxdepth: 10 */
	var left   = dim.left;
	var top    = dim.top;
	var right  = left + dim.width;
	var bottom = top  + dim.height;

	var halfAlpha = 255 / 2;
	var strength = params.strength;
	var angle    = params.angle;
	var ni = Math.cos(angle);
	var nj = Math.sin(angle);

	var d  = params.distance * dim.ratio;
	var di = Math.ceil(ni * d);
	var dj = Math.ceil(nj * d);

	var shadowColor = params.shadowColor;
	var sr = shadowColor.red;
	var sg = shadowColor.green;
	var sb = shadowColor.blue;
	var sa = shadowColor.alpha;

	var highlightColor = params.highlightColor;
	var hr = highlightColor.red;
	var hg = highlightColor.green;
	var hb = highlightColor.blue;
	var ha = highlightColor.alpha;

	var blurX = params.blurX;
	var blurY = params.blurY;
	var nbPasses  = params.numPasses;
	var blurArea  = (2 * blurX + 1) * (2 * blurY + 1);

	// Determining bounds for the blur
	var bevelLeft   = Math.max(0,             Math.min(left,   left   - blurX * nbPasses - di));
	var bevelRight  = Math.min(bounds.right,  Math.max(right,  right  + blurX * nbPasses + di));
	var bevelTop    = Math.max(0,             Math.min(top,    top    - blurY * nbPasses - dj));
	var bevelBottom = Math.min(bounds.bottom, Math.max(bottom, bottom + blurY * nbPasses + dj));

	var w = bevelRight  - bevelLeft;
	var h = bevelBottom - bevelTop;

	if (w <= 0 || h <= 0) {
		return;
	}


	// Constructing blur
	var blurBuffer = context.getImageData(bevelLeft, bevelTop, w, h);
	if (blurX !== 0 || blurY !== 0) {
		var blurBufferTmp = context.createImageData(w, h);
		for (var p = 0; p < nbPasses; p += 1) {
			if (blurX > 0) blurVertical(blurBuffer.data, blurBufferTmp.data, blurX, w, h);
			if (blurY > 0) blurHorizontal(blurBufferTmp.data, blurBuffer.data, blurY, w, h);
		}
	}

	// Constructing bevel
	var bevelBuffer = context.createImageData(w, h);
	var bevelData   = bevelBuffer.data;
	var sourceData  = blurBuffer.data;

	var i, j, k, x, y;
	for (i = 0; i < w; i += 1) {
		for (j = 0; j < h; j += 1) {

			// highlight pixel position
			var hpi = i + di;
			var hpj = j + dj;

			// shadow pixel position
			var spi = i - di;
			var spj = j - dj;

			var hpAlpha, spAlpha;
			if (hpi < 0 || w <= hpi || hpj < 0 || h <= hpj) {
				hpAlpha = 0;
			} else {
				hpAlpha = sourceData[(hpj * w + hpi) * 4 + 3];
			}

			if (spi < 0 || w <= spi || spj < 0 || h <= spj) {
				spAlpha = 0;
			} else {
				spAlpha = sourceData[(spj * w + spi) * 4 + 3];
			}

			var alpha = (hpAlpha - spAlpha) * strength + halfAlpha;

			k = (j * w + i) * 4;
			if (halfAlpha < alpha) {
				bevelData[k]     = hr;
				bevelData[k + 1] = hg;
				bevelData[k + 2] = hb;
				bevelData[k + 3] = ha * (alpha - halfAlpha);
			} else {
				bevelData[k]     = sr;
				bevelData[k + 1] = sg;
				bevelData[k + 2] = sb;
				bevelData[k + 3] = sa * (halfAlpha - alpha);
			}
		}
	}

	// blending bevel image with original
	var dstBuffer = context.getImageData(bevelLeft, bevelTop, w, h);

	// SHOULD DO THIS
	// dstBuffer.data = blend(bevelBuffer, dstBuffer, params.inner, params.knockout, params.onTop);
	// context.putImageData(dstBuffer, bevelLeft, bevelTop);

	// DOING THIS INSTEAD
	var pixelData = blend(bevelBuffer, dstBuffer, params.inner, params.knockout, params.onTop);
	var tmpBuffer = context.createImageData(w, h);
	var tmpData   = tmpBuffer.data;
	var nBytes    = pixelData.length;
	for (i = 0; i < nBytes; i += 4) {
		tmpData[i]     = pixelData[i];
		tmpData[i + 1] = pixelData[i + 1];
		tmpData[i + 2] = pixelData[i + 2];
		tmpData[i + 3] = pixelData[i + 3];
	}
	context.putImageData(tmpBuffer, bevelLeft, bevelTop);

	// Updating dimension of the image
	dim.left   = bevelLeft;
	dim.top    = bevelTop;
	dim.right  = bevelRight;
	dim.bottom = bevelBottom;
	dim.width  = w;
	dim.height = h;
};
