/*
 * The code in this file is licensed under the CC0 license.
 *
 * http://creativecommons.org/publicdomain/zero/1.0/
 *
 * It is free to use for any purpose. No attribution, permission, or reproduction of this license is require
 */

// Modified by Gildas Lormeau (ES5 -> ES6, removed unused code)

// https://github.com/tabatkins/parse-css
this.parseCss = this.parseCss || (() => {

	const BAD_STRING_TOKEN_TYPE = "BADSTRING";
	const BAD_URL_TOKEN_TYPE = "BADURL";
	const WHITESPACE_TOKEN_TYPE = "WHITESPACE";
	const CDO_TOKEN_TYPE = "CDO";
	const CDC_TOKEN_TYPE = "CDO";
	const COLON_TOKEN_TYPE = ":";
	const SEMICOLON_TOKEN_TYPE = ";";
	const COMMA_TOKEN_TYPE = ",";
	const OPEN_CURLY_TOKEN_TYPE = "{";
	const CLOSE_CURLY_TOKEN_TYPE = "}";
	const OPEN_SQUARE_TOKEN_TYPE = "[";
	const CLOSE_SQUARE_TOKEN_TYPE = "]";
	const OPEN_PAREN_TOKEN_TYPE = "(";
	const CLOSE_PAREN_TOKEN_TYPE = ")";
	const INCLUDE_MATCH_TOKEN_TYPE = "~=";
	const DASH_MATCH_TOKEN_TYPE = "|=";
	const PREFIX_MATCH_TOKEN_TYPE = "^=";
	const SUFFIX_MATCH_TOKEN_TYPE = "$=";
	const SUBSTRING_MATCH_TOKEN_TYPE = "*=";
	const COLUMN_TOKEN_TYPE = "||";
	const EOF_TOKEN_TYPE = "EOF";
	const DELIM_TOKEN_TYPE = "DELIM";
	const IDENT_TOKEN_TYPE = "IDENT";
	const FUNCTION_TOKEN_TYPE = "FUNCTION";
	const HASH_TOKEN_TYPE = "HASH";
	const STRING_TOKEN_TYPE = "STRING";
	const URL_TOKEN_TYPE = "URL";
	const NUMBER_TOKEN_TYPE = "NUMBER";
	const PERCENTAGE_TOKEN_TYPE = "PERCENTAGE";
	const DIMENSION_TOKEN_TYPE = "DIMENSION";
	const DECLARATION_TYPE = "DECLARATION";
	const FUNCTION_TYPE = "FUNCTION";

	function digit(code) { return code >= 0x30 && code <= 0x39; }
	function hexdigit(code) { return digit(code) || code >= 0x41 && code <= 0x46 || code >= 0x61 && code <= 0x66; }
	function namestartchar(code) { return code >= 0x41 && code <= 0x5a || code >= 0x61 && code <= 0x7a || code >= 0x80 || code == 0x5f; }
	function namechar(code) { return namestartchar(code) || digit(code) || code == 0x2d; }
	function nonprintable(code) { return code >= 0 && code <= 8 || code == 0xb || code >= 0xe && code <= 0x1f || code == 0x7f; }
	function newline(code) { return code == 0xa; }
	function whitespace(code) { return newline(code) || code == 9 || code == 0x20; }

	const maximumallowedcodepoint = 0x10ffff;

	function preprocess(str) {
		// Turn a string into an array of code points,
		// following the preprocessing cleanup rules.
		const codepoints = [];
		for (let i = 0; i < str.length; i++) {
			let code = str.codePointAt(i);
			if (code == 0xd && str.codePointAt(i + 1) == 0xa) {
				code = 0xa; i++;
			}
			if (code == 0xd || code == 0xc) code = 0xa;
			if (code == 0x0) code = 0xfffd;
			codepoints.push(code);
		}
		return codepoints;
	}

	function consumeAToken(consume, next, eof, reconsume, parseerror, donothing) {
		consumeComments(consume, next, eof, parseerror);
		let code = consume();
		if (whitespace(code)) {
			while (whitespace(next())) code = consume();
			return new Token(WHITESPACE_TOKEN_TYPE);
		} else {
			switch (code) {
				case 0x22:
					return consumeAStringToken(consume, next, eof, reconsume, parseerror, donothing, code);
				case 0x23:
					if (namechar(next()) || areAValidEscape(next(1), next(2))) {
						const token = new Token(HASH_TOKEN_TYPE);
						if (wouldStartAnIdentifier(next(1), next(2), next(3))) token.type = "id";
						token.value = consumeAName(consume, next, eof, reconsume);
						return token;
					} else {
						return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
					}
				case 0x24:
					if (next() == 0x3d) {
						code = consume();
						return new Token(SUFFIX_MATCH_TOKEN_TYPE);
					} else {
						return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
					}
				case 0x27:
					return consumeAStringToken(consume, next, eof, reconsume, parseerror, donothing, code);
				case 0x28:
					return new Token(OPEN_PAREN_TOKEN_TYPE);
				case 0x29:
					return new Token(CLOSE_PAREN_TOKEN_TYPE);
				case 0x2a:
					if (next() == 0x3d) {
						code = consume();
						return new Token(SUBSTRING_MATCH_TOKEN_TYPE);
					} else {
						return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
					}
				case 0x2b:
					if (startsWithANumber(next, code)) {
						reconsume();
						return consumeANumericToken(consume, next, eof, reconsume);
					} else {
						return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
					}
				case 0x2c:
					return new Token(COMMA_TOKEN_TYPE);
				case 0x2d:
					if (startsWithANumber(next, code)) {
						reconsume();
						return consumeANumericToken(consume, next, eof, reconsume);
					} else if (next(1) == 0x2d && next(2) == 0x3e) {
						consume(2);
						return new Token(CDC_TOKEN_TYPE);
					} else if (wouldStartAnIdentifier(code, next(1), next(2))) {
						reconsume();
						return consumeAnIdentlikeToken(consume, next, eof, reconsume, parseerror, donothing);
					} else {
						return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
					}
				case 0x2e:
					if (startsWithANumber(next, code)) {
						reconsume();
						return consumeANumericToken(consume, next, eof, reconsume);
					} else {
						return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
					}
				case 0x3a:
					return new Token(COLON_TOKEN_TYPE);
				case 0x3b:
					return new Token(SEMICOLON_TOKEN_TYPE);
				case 0x3c:
					if (next(1) == 0x21 && next(2) == 0x2d && next(3) == 0x2d) {
						consume(3);
						return new Token(CDO_TOKEN_TYPE);
					} else {
						return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
					}
				case 0x40:
					return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
				case 0x5b:
					return new Token(OPEN_SQUARE_TOKEN_TYPE);
				case 0x5c:
					if (startsWithAValidEscape(next, code)) {
						reconsume();
						return consumeAnIdentlikeToken(consume, next, eof, reconsume, parseerror, donothing);
					} else {
						parseerror();
						return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
					}
				case 0x5d:
					return new Token(CLOSE_SQUARE_TOKEN_TYPE);
				case 0x5e:
					if (next() == 0x3d) {
						code = consume();
						return new Token(PREFIX_MATCH_TOKEN_TYPE);
					} else {
						return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
					}
				case 0x7b:
					return new Token(OPEN_CURLY_TOKEN_TYPE);
				case 0x7c:
					if (next() == 0x3d) {
						code = consume();
						return new Token(DASH_MATCH_TOKEN_TYPE);
					} else if (next() == 0x7c) {
						code = consume();
						return new Token(COLUMN_TOKEN_TYPE);
					} else {
						return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
					}
				case 0x7d:
					return new Token(CLOSE_CURLY_TOKEN_TYPE);
				case 0x7e:
					if (next() == 0x3d) {
						code = consume();
						return new Token(INCLUDE_MATCH_TOKEN_TYPE);
					} else {
						return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
					}
				default:
					if (digit(code)) {
						reconsume();
						return consumeANumericToken(consume, next, eof, reconsume);
					}
					else if (namestartchar(code)) {
						reconsume();
						return consumeAnIdentlikeToken(consume, next, eof, reconsume, parseerror, donothing);
					}
					else if (eof()) return new Token(EOF_TOKEN_TYPE);
					else return new Token(DELIM_TOKEN_TYPE, String.fromCodePoint(code));
			}
		}
	}


	function consumeComments(consume, next, eof, parseerror) {
		while (next(1) == 0x2f && next(2) == 0x2a) {
			consume(2);
			while (true) { // eslint-disable-line no-constant-condition
				let code = consume();
				if (code == 0x2a && next() == 0x2f) {
					code = consume();
					break;
				} else if (eof()) {
					parseerror();
					return;
				}
			}
		}
	}

	function consumeANumericToken(consume, next, eof, reconsume) {
		const num = consumeANumber(consume, next);
		if (wouldStartAnIdentifier(next(1), next(2), next(3))) {
			const token = new Token(DIMENSION_TOKEN_TYPE, num.value);
			token.repr = num.repr;
			token.type = num.type;
			token.unit = consumeAName(consume, next, eof, reconsume);
			return token;
		} else if (next() == 0x25) {
			consume();
			const token = new Token(PERCENTAGE_TOKEN_TYPE, num.value);
			token.repr = num.repr;
			return token;
		} else {
			const token = new Token(NUMBER_TOKEN_TYPE, num.value);
			token.type = "integer";
			token.repr = num.repr;
			token.type = num.type;
			return token;
		}
	}

	function consumeAnIdentlikeToken(consume, next, eof, reconsume, parseerror, donothing) {
		const str = consumeAName(consume, next, eof, reconsume);
		if (str.toLowerCase() == "url" && next() == 0x28) {
			consume();
			while (whitespace(next(1)) && whitespace(next(2))) consume();
			if (next() == 0x22 || next() == 0x27) {
				return new Token(FUNCTION_TOKEN_TYPE, str);
			} else if (whitespace(next()) && (next(2) == 0x22 || next(2) == 0x27)) {
				return new Token(FUNCTION_TOKEN_TYPE, str);
			} else {
				return consumeAURLToken(consume, next, eof, parseerror, donothing);
			}
		} else if (next() == 0x28) {
			consume();
			return new Token(FUNCTION_TOKEN_TYPE, str);
		} else {
			return new Token(IDENT_TOKEN_TYPE, str);
		}
	}

	function consumeAStringToken(consume, next, eof, reconsume, parseerror, donothing, code) {
		const endingCodePoint = code;
		let string = "";
		while (code = consume()) { // eslint-disable-line no-cond-assign
			if (code == endingCodePoint || eof()) {
				return new Token(STRING_TOKEN_TYPE, string);
			} else if (newline(code)) {
				parseerror();
				reconsume();
				return new Token(BAD_STRING_TOKEN_TYPE);
			} else if (code == 0x5c) {
				if (eof(next())) {
					donothing();
				} else if (newline(next())) {
					code = consume();
				} else {
					string += String.fromCodePoint(consumeEscape(consume, next, eof));
				}
			} else {
				string += String.fromCodePoint(code);
			}
		}
	}

	function consumeAURLToken(consume, next, eof, parseerror, donothing) {
		const token = new Token(URL_TOKEN_TYPE, "");
		while (whitespace(next())) consume();
		if (eof(next())) return token;
		let code;
		while (code = consume()) { // eslint-disable-line no-cond-assign
			if (code == 0x29 || eof()) {
				return token;
			} else if (whitespace(code)) {
				while (whitespace(next())) code = consume();
				if (next() == 0x29 || eof(next())) {
					code = consume();
					return token;
				} else {
					consumeTheRemnantsOfABadURL(consume, next, eof, donothing);
					return new Token(BAD_URL_TOKEN_TYPE);
				}
			} else if (code == 0x22 || code == 0x27 || code == 0x28 || nonprintable(code)) {
				parseerror();
				consumeTheRemnantsOfABadURL(consume, next, eof, donothing);
				return new Token(BAD_URL_TOKEN_TYPE);
			} else if (code == 0x5c) {
				if (startsWithAValidEscape(next, code)) {
					token.value += String.fromCodePoint(consumeEscape(consume, next, eof));
				} else {
					parseerror();
					consumeTheRemnantsOfABadURL(consume, next, eof, donothing);
					return new Token(BAD_URL_TOKEN_TYPE);
				}
			} else {
				token.value += String.fromCodePoint(code);
			}
		}
	}

	function consumeEscape(consume, next, eof) {
		// Assume the the current character is the \
		// and the next code point is not a newline.
		let code = consume();
		if (hexdigit(code)) {
			// Consume 1-6 hex digits
			const digits = [code];
			for (let total = 0; total < 5; total++) {
				if (hexdigit(next())) {
					code = consume();
					digits.push(code);
				} else {
					break;
				}
			}
			if (whitespace(next())) code = consume();
			let value = parseInt(digits.map(function (x) { return String.fromCharCode(x); }).join(""), 16);
			if (value > maximumallowedcodepoint) value = 0xfffd;
			return value;
		} else if (eof()) {
			return 0xfffd;
		} else {
			return code;
		}
	}

	function areAValidEscape(c1, c2) {
		if (c1 != 0x5c) return false;
		if (newline(c2)) return false;
		return true;
	}

	function startsWithAValidEscape(next, code) {
		return areAValidEscape(code, next());
	}

	function wouldStartAnIdentifier(c1, c2, c3) {
		if (c1 == 0x2d) {
			return namestartchar(c2) || c2 == 0x2d || areAValidEscape(c2, c3);
		} else if (namestartchar(c1)) {
			return true;
		} else if (c1 == 0x5c) {
			return areAValidEscape(c1, c2);
		} else {
			return false;
		}
	}

	function wouldStartANumber(c1, c2, c3) {
		if (c1 == 0x2b || c1 == 0x2d) {
			if (digit(c2)) return true;
			if (c2 == 0x2e && digit(c3)) return true;
			return false;
		} else if (c1 == 0x2e) {
			if (digit(c2)) return true;
			return false;
		} else if (digit(c1)) {
			return true;
		} else {
			return false;
		}
	}

	function startsWithANumber(next, code) {
		return wouldStartANumber(code, next(1), next(2));
	}

	function consumeAName(consume, next, eof, reconsume) {
		let result = "", code;
		while (code = consume()) { // eslint-disable-line no-cond-assign
			if (namechar(code)) {
				result += String.fromCodePoint(code);
			} else if (startsWithAValidEscape(next, code)) {
				result += String.fromCodePoint(consumeEscape(consume, next, eof));
			} else {
				reconsume();
				return result;
			}
		}
	}

	function consumeANumber(consume, next) {
		let repr = [], type = "integer";
		let code;
		if (next() == 0x2b || next() == 0x2d) {
			code = consume();
			repr += String.fromCodePoint(code);
		}
		while (digit(next())) {
			code = consume();
			repr += String.fromCodePoint(code);
		}
		if (next(1) == 0x2e && digit(next(2))) {
			code = consume();
			repr += String.fromCodePoint(code);
			code = consume();
			repr += String.fromCodePoint(code);
			type = "number";
			while (digit(next())) {
				code = consume();
				repr += String.fromCodePoint(code);
			}
		}
		const c1 = next(1), c2 = next(2), c3 = next(3);
		if ((c1 == 0x45 || c1 == 0x65) && digit(c2)) {
			code = consume();
			repr += String.fromCodePoint(code);
			code = consume();
			repr += String.fromCodePoint(code);
			type = "number";
			while (digit(next())) {
				code = consume();
				repr += String.fromCodePoint(code);
			}
		} else if ((c1 == 0x45 || c1 == 0x65) && (c2 == 0x2b || c2 == 0x2d) && digit(c3)) {
			code = consume();
			repr += String.fromCodePoint(code);
			code = consume();
			repr += String.fromCodePoint(code);
			code = consume();
			repr += String.fromCodePoint(code);
			type = "number";
			while (digit(next())) {
				code = consume();
				repr += String.fromCodePoint(code);
			}
		}
		const value = convertAStringToANumber(repr);
		return { type, value, repr };
	}

	function convertAStringToANumber(string) {
		// CSS's number rules are identical to JS, afaik.
		return Number(string);
	}

	function consumeTheRemnantsOfABadURL(consume, next, eof, donothing) {
		let code;
		while (code = consume()) { // eslint-disable-line no-cond-assign
			if (code == 0x29 || eof()) {
				return;
			} else if (startsWithAValidEscape(next, code)) {
				consumeEscape(consume, next, eof);
				donothing();
			} else {
				donothing();
			}
		}
	}

	function tokenize(str) {
		str = preprocess(str);
		let i = -1;
		const tokens = [];
		const strLength = str.length;
		let code;

		// Line number information.
		let line = 0, column = 0;

		// The only use of lastLineLength is in reconsume().
		let lastLineLength = 0;
		const incrLineno = function () {
			line += 1;
			lastLineLength = column;
			column = 0;
		};
		const locStart = { line, column };

		const codepoint = function (i) {
			if (i >= strLength) {
				return -1;
			}
			return str[i];
		};
		const next = function (num) {
			if (num === undefined)
				num = 1;
			if (num > 3)
				throw "Spec Error: no more than three codepoints of lookahead.";
			return codepoint(i + num);
		};
		const consume = function (num) {
			if (num === undefined)
				num = 1;
			i += num;
			const code = codepoint(i);
			if (newline(code)) incrLineno();
			else column += num;
			//console.log('Consume '+i+' '+String.fromCharCode(code) + ' 0x' + code.toString(16));
			return code;
		};
		const reconsume = function () {
			i -= 1;
			if (newline(code)) {
				line -= 1;
				column = lastLineLength;
			} else {
				column -= 1;
			}
			locStart.line = line;
			locStart.column = column;
			return true;
		};
		const eof = function (codepoint) {
			if (codepoint === undefined) codepoint = code;
			return codepoint == -1;
		};
		const donothing = function () { };
		const parseerror = function () { throw new Error("Parse error at index " + i + ", processing codepoint 0x" + code.toString(16) + "."); };

		let iterationCount = 0;
		while (!eof(next())) {
			tokens.push(consumeAToken(consume, next, eof, reconsume, parseerror, donothing));
			iterationCount++;
			if (iterationCount > strLength * 2) return "I'm infinite-looping!";
		}
		return tokens;
	}

	class Token {
		constructor(tokenType, value) {
			this.tokenType = tokenType;
			this.value = value;
			this.repr = null;
			this.type = null;
			this.unit = null;
		}
	}

	// ---
	class TokenStream {
		constructor(tokens) {
			// Assume that tokens is an array.
			this.tokens = tokens;
			this.i = -1;
		}
		tokenAt(i) {
			if (i < this.tokens.length)
				return this.tokens[i];
			return new Token(EOF_TOKEN_TYPE);
		}
		consume(num) {
			if (num === undefined)
				num = 1;
			this.i += num;
			this.token = this.tokenAt(this.i);
			//console.log(this.i, this.token);
			return true;
		}
		next() {
			return this.tokenAt(this.i + 1);
		}
		reconsume() {
			this.i--;
		}
	}

	function parseerror(s, msg) {
		throw new Error("Parse error at token " + s.i + ": " + s.token + ".\n" + msg);
	}
	function donothing() { return true; }

	function consumeAListOfDeclarations(s) {
		const decls = [];
		while (s.consume()) {
			if (s.token.tokenType == WHITESPACE_TOKEN_TYPE || s.token.tokenType == SEMICOLON_TOKEN_TYPE) {
				donothing();
			} else if (s.token.tokenType == EOF_TOKEN_TYPE) {
				return decls;
			} else if (s.token.tokenType == IDENT_TOKEN_TYPE) {
				const temp = [s.token];
				while (!(s.next().tokenType == SEMICOLON_TOKEN_TYPE || s.next().tokenType == EOF_TOKEN_TYPE))
					temp.push(consumeAComponentValue(s));
				const decl = consumeADeclaration(new TokenStream(temp));
				if (decl) decls.push(decl);
			} else {
				parseerror(s);
				s.reconsume();
				while (!(s.next().tokenType == SEMICOLON_TOKEN_TYPE || s.next().tokenType == EOF_TOKEN_TYPE))
					consumeAComponentValue(s);
			}
		}
	}

	function consumeADeclaration(s) {
		// Assumes that the next input token will be an ident token.
		s.consume();
		const decl = new Declaration(s.token.value);
		while (s.next().tokenType == WHITESPACE_TOKEN_TYPE) s.consume();
		if (!(s.next().tokenType == COLON_TOKEN_TYPE)) {
			parseerror(s);
			return;
		} else {
			s.consume();
		}
		while (!(s.next().tokenType == EOF_TOKEN_TYPE)) {
			decl.value.push(consumeAComponentValue(s));
		}
		let foundImportant = false;
		for (let i = decl.value.length - 1; i >= 0; i--) {
			if (decl.value[i].tokenType == WHITESPACE_TOKEN_TYPE) {
				continue;
			} else if (decl.value[i].tokenType == IDENT_TOKEN_TYPE && decl.value[i].value.toLowerCase() == "important") {
				foundImportant = true;
			} else if (foundImportant && decl.value[i].tokenType == DELIM_TOKEN_TYPE && decl.value[i].value == "!") {
				decl.value.splice(i, decl.value.length);
				decl.important = true;
				break;
			} else {
				break;
			}
		}
		return decl;
	}

	function consumeAComponentValue(s) {
		s.consume();
		if (s.token.tokenType == FUNCTION_TOKEN_TYPE)
			return consumeAFunction(s);
		return s.token;
	}

	function consumeAFunction(s) {
		const func = new Func(s.token.value);
		while (s.consume()) {
			if (s.token.tokenType == EOF_TOKEN_TYPE || s.token.tokenType == CLOSE_PAREN_TOKEN_TYPE)
				return func;
			else {
				s.reconsume();
				func.value.push(consumeAComponentValue(s));
			}
		}
	}

	function normalizeInput(input) {
		if (typeof input == "string")
			return new TokenStream(tokenize(input));
		else throw SyntaxError(input);
	}

	function parseAListOfDeclarations(s) {
		s = normalizeInput(s);
		return consumeAListOfDeclarations(s);
	}
	class Declaration {
		constructor(name) {
			this.name = name;
			this.value = [];
			this.important = false;
			this.type = DECLARATION_TYPE;
		}
	}

	class Func {
		constructor(name) {
			this.name = name;
			this.value = [];
			this.type = FUNCTION_TYPE;
		}
	}

	// Exportation.

	return {
		parseAListOfDeclarations
	};

})();