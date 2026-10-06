/* ==========================================================================
   Contact page — client-side validation + submission
   The message is POSTed to /api/contact and stored in data/messages.json.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('contactForm');
  var alertBox = document.getElementById('contactAlert');
  var submitBtn = document.getElementById('contactSubmit');
  var messageField = document.getElementById('contactMessage');
  var counter = document.getElementById('contactCount');
  if (!form) return;

  var MAX = 4000;

  function setFieldError(field, message) {
    if (!field) return;
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    var hint = field.parentNode.querySelector('.field__hint--error');
    if (message) {
      if (!hint) {
        hint = document.createElement('p');
        hint.className = 'field__hint field__hint--error';
        hint.style.color = 'var(--danger)';
        field.parentNode.appendChild(hint);
      }
      hint.textContent = message;
    } else if (hint) {
      hint.remove();
    }
  }

  function validate() {
    var name = document.getElementById('contactName');
    var email = document.getElementById('contactEmail');
    var message = messageField;
    var ok = true;

    if (!name.value.trim() || name.value.trim().length < 2) {
      setFieldError(name, 'Please enter your name (at least 2 characters).');
      ok = false;
    } else {
      setFieldError(name, '');
    }

    var emailValue = email.value.trim();
    var emailPattern = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
    if (!emailValue) {
      setFieldError(email, 'Please enter your email address so we can reply.');
      ok = false;
    } else if (!emailPattern.test(emailValue)) {
      setFieldError(email, 'That email address does not look valid — check for a missing @ or domain.');
      ok = false;
    } else {
      setFieldError(email, '');
    }

    if (!message.value.trim()) {
      setFieldError(message, 'Please write a message first.');
      ok = false;
    } else if (message.value.length > MAX) {
      setFieldError(message, 'Your message is ' + message.value.length + ' characters — the limit is ' + MAX + '.');
      ok = false;
    } else {
      setFieldError(message, '');
    }

    return ok;
  }

  if (messageField && counter) {
    var syncCounter = function () {
      counter.textContent = messageField.value.length;
    };
    messageField.addEventListener('input', syncCounter);
    syncCounter();
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    ToolBox.clearAlert(alertBox);

    if (!validate()) {
      ToolBox.showAlert(alertBox, 'error', 'Please fix the highlighted fields and try again.');
      var firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    var payload = {
      name: document.getElementById('contactName').value.trim(),
      email: document.getElementById('contactEmail').value.trim(),
      subject: document.getElementById('contactSubject').value.trim(),
      message: messageField.value.trim(),
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.success) {
          throw new Error((result.data && result.data.error) || 'Your message could not be sent.');
        }
        form.reset();
        if (counter) counter.textContent = '0';
        ToolBox.showAlert(
          alertBox,
          'success',
          'Thanks — your message has been sent. We usually reply within a couple of working days.'
        );
        ToolBox.toast('Message sent');
      })
      .catch(function (error) {
        ToolBox.showAlert(alertBox, 'error', error.message || 'Something went wrong. Please try again in a moment.');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send message';
        }
      });
  });

  form.addEventListener('reset', function () {
    ['contactName', 'contactEmail', 'contactSubject', 'contactMessage'].forEach(function (id) {
      setFieldError(document.getElementById(id), '');
    });
    ToolBox.clearAlert(alertBox);
    if (counter) counter.textContent = '0';
  });
})();
