/* ==========================================================================
   Age Calculator — /tools/age-calculator
   Calendar-accurate age maths (leap years, month lengths, birthday boundaries).
   Runs entirely in the browser: the date you enter is never transmitted.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('ageForm');
  var birthInput = document.getElementById('birthDate');
  var asOfInput = document.getElementById('asOfDate');
  var alertBox = document.getElementById('ageAlert');
  var results = document.getElementById('ageResults');
  var out = {
    years: document.getElementById('ageYears'),
    months: document.getElementById('ageMonths'),
    days: document.getElementById('ageDays'),
    totalMonths: document.getElementById('ageTotalMonths'),
    totalWeeks: document.getElementById('ageTotalWeeks'),
    totalDays: document.getElementById('ageTotalDays'),
    totalHours: document.getElementById('ageTotalHours'),
    totalMinutes: document.getElementById('ageTotalMinutes'),
    nextBirthday: document.getElementById('ageNextBirthday'),
    nextBirthdayWeekday: document.getElementById('ageNextBirthdayWeekday'),
    bornWeekday: document.getElementById('ageBornWeekday'),
    zodiac: document.getElementById('ageZodiac'),
    summary: document.getElementById('ageSummary'),
  };
  if (!form || !birthInput) return;

  var MS_PER_DAY = 86400000;

  function parseDateInput(value) {
    if (!value) return null;
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    var date = new Date(Date.UTC(year, month - 1, day));
    // Reject impossible dates such as 2023-02-30.
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return null;
    }
    return date;
  }

  function todayUtc() {
    var now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  function toInputValue(date) {
    var y = date.getUTCFullYear();
    var m = String(date.getUTCMonth() + 1).padStart(2, '0');
    var d = String(date.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  }

  /**
   * Add a number of months to a date, clamping the day to the length of the
   * target month (31 January + 1 month = 28/29 February). This is the same
   * convention used by calendar software and by law for "same day next month".
   */
  function addMonthsClamped(date, months) {
    var total = date.getUTCMonth() + months;
    var year = date.getUTCFullYear() + Math.floor(total / 12);
    var month = ((total % 12) + 12) % 12;
    var day = Math.min(date.getUTCDate(), daysInMonth(year, month));
    return new Date(Date.UTC(year, month, day));
  }

  /**
   * Exact calendar difference between two dates.
   *
   * Works in months first (clamped at month ends), then counts the remaining
   * whole days. This is what makes 31 January → 1 March come out as
   * "1 month, 1 day" instead of a negative or inflated day count, and it keeps
   * leap years and 28/30/31-day months correct for every input.
   */
  function diffYMD(from, to) {
    var totalMonths = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
    if (totalMonths < 0) totalMonths = 0;

    var anchor = addMonthsClamped(from, totalMonths);
    // At most one step is normally needed; the loop guards odd month ends.
    while (totalMonths > 0 && anchor.getTime() > to.getTime()) {
      totalMonths -= 1;
      anchor = addMonthsClamped(from, totalMonths);
    }

    var years = Math.floor(totalMonths / 12);
    var months = totalMonths % 12;
    var days = Math.round((to.getTime() - anchor.getTime()) / MS_PER_DAY);

    return { years: years, months: months, days: days, totalMonths: totalMonths };
  }

  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  function nextBirthday(from, birth) {
    var month = birth.getUTCMonth();
    var day = birth.getUTCDate();
    var year = from.getUTCFullYear();
    // 29 February birthdays fall back to 28 February in non-leap years.
    var candidateDay = day === 29 && month === 1 && !isLeapYear(year) ? 28 : day;
    var candidate = new Date(Date.UTC(year, month, candidateDay));
    if (candidate < from) {
      var nextYear = year + 1;
      var nextDay = day === 29 && month === 1 && !isLeapYear(nextYear) ? 28 : day;
      candidate = new Date(Date.UTC(nextYear, month, nextDay));
    }
    return candidate;
  }

  function zodiacOf(date) {
    var month = date.getUTCMonth() + 1;
    var day = date.getUTCDate();
    var signs = [
      [1, 20, 'Capricorn', 'Aquarius'],
      [2, 19, 'Aquarius', 'Pisces'],
      [3, 21, 'Pisces', 'Aries'],
      [4, 20, 'Aries', 'Taurus'],
      [5, 21, 'Taurus', 'Gemini'],
      [6, 21, 'Gemini', 'Cancer'],
      [7, 23, 'Cancer', 'Leo'],
      [8, 23, 'Leo', 'Virgo'],
      [9, 23, 'Virgo', 'Libra'],
      [10, 23, 'Libra', 'Scorpio'],
      [11, 22, 'Scorpio', 'Sagittarius'],
      [12, 22, 'Sagittarius', 'Capricorn'],
    ];
    var row = signs[month - 1];
    return day < row[1] ? row[2] : row[3];
  }

  function formatLongDate(date) {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  function weekday(date) {
    return date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  }

  function number(value) {
    return Number(value).toLocaleString('en-US');
  }

  function pluralise(count, singular, plural) {
    return count + ' ' + (count === 1 ? singular : plural || singular + 's');
  }

  function showResults() {
    if (results) results.hidden = false;
  }

  function hideResults() {
    if (results) results.hidden = true;
  }

  function calculate(event) {
    if (event) event.preventDefault();

    var birth = parseDateInput(birthInput.value);
    if (!birthInput.value) {
      ToolBox.showAlert(alertBox, 'error', 'Please choose a date of birth first.');
      birthInput.setAttribute('aria-invalid', 'true');
      hideResults();
      return;
    }
    if (!birth) {
      ToolBox.showAlert(alertBox, 'error', 'That date of birth is not a real calendar date. Please pick it again from the date picker.');
      birthInput.setAttribute('aria-invalid', 'true');
      hideResults();
      return;
    }
    birthInput.removeAttribute('aria-invalid');

    var asOf = asOfInput && asOfInput.value ? parseDateInput(asOfInput.value) : todayUtc();
    if (!asOf) {
      ToolBox.showAlert(alertBox, 'error', 'The “calculate age as of” date is not a valid calendar date.');
      hideResults();
      return;
    }

    if (birth.getTime() > asOf.getTime()) {
      ToolBox.showAlert(
        alertBox,
        'error',
        'A date of birth in the future cannot be used — ' + formatLongDate(birth) + ' comes after ' + formatLongDate(asOf) + '. Please check the date.'
      );
      birthInput.setAttribute('aria-invalid', 'true');
      hideResults();
      return;
    }

    ToolBox.clearAlert(alertBox);

    var diff = diffYMD(birth, asOf);

    // Whole calendar months and whole days between the two dates. UTC is used
    // throughout so a daylight-saving change can never shift the result.
    var totalMonths = diff.totalMonths;
    var totalDays = Math.floor((asOf.getTime() - birth.getTime()) / MS_PER_DAY);
    var totalWeeks = Math.floor(totalDays / 7);

    if (out.years) out.years.textContent = number(diff.years);
    if (out.months) out.months.textContent = number(diff.months);
    if (out.days) out.days.textContent = number(diff.days);
    if (out.totalMonths) out.totalMonths.textContent = number(totalMonths);
    if (out.totalWeeks) out.totalWeeks.textContent = number(totalWeeks);
    if (out.totalDays) out.totalDays.textContent = number(totalDays);
    if (out.totalHours) out.totalHours.textContent = number(totalDays * 24);
    if (out.totalMinutes) out.totalMinutes.textContent = number(totalDays * 24 * 60);

    var upcoming = nextBirthday(asOf, birth);
    var daysUntil = Math.round((upcoming.getTime() - asOf.getTime()) / MS_PER_DAY);
    var turning = diff.years + (daysUntil === 0 ? 0 : 1);
    var isBirthday = birth.getUTCMonth() === asOf.getUTCMonth() && birth.getUTCDate() === asOf.getUTCDate();

    if (out.nextBirthday) {
      out.nextBirthday.textContent = formatLongDate(upcoming) + (isBirthday ? ' (today 🎉)' : '');
    }
    if (out.nextBirthdayWeekday) {
      out.nextBirthdayWeekday.textContent = isBirthday
        ? 'Happy birthday!'
        : weekday(upcoming) + ' • ' + pluralise(daysUntil, 'day') + ' from the reference date';
    }
    if (out.bornWeekday) out.bornWeekday.textContent = weekday(birth);
    if (out.zodiac) out.zodiac.textContent = zodiacOf(birth);

    if (out.summary) {
      var summaryText = isBirthday
        ? 'On ' + formatLongDate(asOf) + ' this person turns ' + number(diff.years) + ' years old — today is their birthday.'
        : 'Born on ' + formatLongDate(birth) + ', this person is ' +
          pluralise(diff.years, 'year') + ', ' + pluralise(diff.months, 'month') + ' and ' +
          pluralise(diff.days, 'day') + ' old on ' + formatLongDate(asOf) +
          ' — that is ' + pluralise(totalDays, 'day') + ' in total, and they turn ' + number(turning) +
          ' on ' + formatLongDate(upcoming) + '.';
      out.summary.textContent = summaryText;
    }

    showResults();
    ToolBox.toast('Age calculated');

    if (!event) {
      // Called from a programmatic path (deep link): no user action to report.
      return;
    }
  }

  form.addEventListener('submit', calculate);
  birthInput.addEventListener('input', function () {
    if (birthInput.value) calculate();
  });
  if (asOfInput) {
    asOfInput.addEventListener('change', function () {
      if (birthInput.value) calculate();
    });
  }

  ToolBox.qsa('[data-birth-example]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      birthInput.value = chip.getAttribute('data-birth-example');
      calculate();
    });
  });

  // Default the "as of" field to today so the form is immediately usable.
  if (asOfInput && !asOfInput.value) asOfInput.value = toInputValue(todayUtc());

  // Deep links: /tools/age-calculator?dob=1990-05-17&asof=2025-01-01
  var params = new URLSearchParams(window.location.search);
  var dob = params.get('dob') || params.get('birth') || '';
  if (parseDateInput(dob)) {
    birthInput.value = dob;
    if (params.get('asof') && parseDateInput(params.get('asof'))) asOfInput.value = params.get('asof');
    calculate();
  } else {
    hideResults();
  }
})();
