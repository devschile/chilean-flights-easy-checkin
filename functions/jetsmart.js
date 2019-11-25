const chromium = require('chrome-aws-lambda')
const puppeteer = require('puppeteer')
const { isValid, parse } = require('date-fns')
const { validate, clean } = require('rut.js')
const logger = require('./utils/logger')

/**
 * @param {number} timeout - Delay in ms.
 * @returns {Promise<void>} -
 * @example
 * await delay(5000)
 */
const delay = timeout => {
  return new Promise(resolve => {
    setTimeout(resolve, timeout)
  })
}

/* eslint-disable sonarjs/no-duplicate-string, sonarjs/cognitive-complexity */
/**
 * @typedef {import('aws-lambda').APIGatewayProxyEvent} APIGatewayProxyEvent
 * @typedef {import('aws-lambda').APIGatewayProxyResult} APIGatewayProxyResult
 */
/**
 * @param {APIGatewayProxyEvent} event -
 * @returns {Promise<APIGatewayProxyResult>} -
 * @example
 * const result = await jetsmart(event)
 */
exports.handler = async event => {
  logger.debug(`NODE_ENV=${process.env.NODE_ENV}`)
  /** @type {APIGatewayProxyResult} */
  const response = {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true })
  }
  const errors = []
  /** @type {import('puppeteer').Browser} */
  let browser
  try {
    const DOCUMENT_TYPES = new Map([
      ['rut', 'N'],
      ['passport', 'P'],
      ['dni', 'DNI']
    ])
    const GENDERS = new Map([['male', '1'], ['female', '2']])
    let body = {}
    if (event.httpMethod === 'GET') {
      body = event.queryStringParameters
    } else if (event.httpMethod === 'POST') {
      body = JSON.parse(event.body)
    }
    const {
      code,
      lastName,
      rut,
      birthDate,
      gender,
      emergencyContactName,
      emergencyContactPhoneNumber,
      emergencyContactEmail
    } = body
    logger.debug(`body: ${JSON.stringify(body)}`)
    if (!/^\w{6}$/.test(code)) errors.push('EINVALIDCODE')
    if (!validate(rut)) errors.push('EINVALIDRUT')
    if (!isValid(parse(birthDate, 'yyyy-MM-dd', new Date()))) {
      errors.push('EINVALIDBIRTHDAY')
    }
    if (!GENDERS.has(gender)) errors.push('EINVALIDGENDER')
    if (lastName.trim() === '') errors.push('EINVALIDLASTNAME')
    if (emergencyContactName.trim() === '') {
      errors.push('EINVALIDEMERGENCYCONTACTNAME')
    }
    if (!/^\+?\d{9,11}$/.test(emergencyContactPhoneNumber)) {
      errors.push('EINVALIDEMERGENCYCONTACTPHONENUMBER')
    }
    if (!/^\w+@\w+\.\w+$/.test(emergencyContactEmail)) {
      errors.push('EINVALIDEMERGENCYCONTACTPHONENUMBER')
    }
    if (errors.length > 0) {
      response.statusCode = 400
      response.body = JSON.stringify({ success: false, errors })
      return response
    }
    const [birthdateYear, birthdateMonth, birthdateDay] = birthDate.split('-')
    logger.debug('launch browser')
    if (process.env.NODE_ENV === 'production') {
      browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless
      })
    } else {
      browser = await puppeteer.launch()
    }

    logger.debug('open new page')
    const page = await browser.newPage()

    const navigationPromise = page.waitForNavigation()

    logger.debug('go to jetsmart')
    await page.goto('https://jetsmart.com/cl/es/')
    await page.setViewport({ width: 1366, height: 663 })
    await navigationPromise

    logger.debug('open checkin modal')
    await page.waitForSelector(
      '.right > .login-container > li:nth-child(1) > a > span'
    )
    await page.click('.right > .login-container > li:nth-child(1) > a > span')

    logger.debug('select checkin by lastname')
    await page.waitForSelector(
      '.modal-content > .row > .col-xs-1 > .modal-right-content > .modal-form > .row > .col-xs-1-2:nth-child(2) > .form-group > label'
    )
    await page.click(
      '.modal-content > .row > .col-xs-1 > .modal-right-content > .modal-form > .row > .col-xs-1-2:nth-child(2) > .form-group > label'
    )

    logger.debug(`type lastname ${lastName}`)
    await page.waitForSelector(
      '.modal-content > .row > .col-xs-1 > .modal-right-content > .modal-form > .form-group > input:nth-child(2)'
    )
    await page.type(
      '.modal-content > .row > .col-xs-1 > .modal-right-content > .modal-form > .form-group > input:nth-child(2)',
      lastName
    )

    logger.debug(`type code ${code}`)
    await page.waitForSelector(
      '.modal-content > .row > .col-xs-1 > .modal-right-content > .modal-form > .form-group:nth-child(3) > input'
    )
    await page.type(
      '.modal-content > .row > .col-xs-1 > .modal-right-content > .modal-form > .form-group:nth-child(3) > input',
      code
    )

    logger.debug('send modal')
    await page.waitForSelector(
      '.modal-content > .row > .col-xs-1 > .modal-right-content > .modal-form > .row > .col-xs-1 > .btn-secondary'
    )
    await page.click(
      '.modal-content > .row > .col-xs-1 > .modal-right-content > .modal-form > .row > .col-xs-1 > .btn-secondary'
    )
    await navigationPromise

    logger.debug('click in checkin')
    await page.waitForSelector(
      '.row > .col-xs-1-2 > .checkin-tooltip > .mdl-button > .mdl-button__ripple-container'
    )
    if (
      (await page.$(
        '.row > .col-xs-1-2 > #checkinTooltip0 > .mdl-button > .mdl-button__ripple-container'
      )) !== null
    ) {
      await page.click(
        '.row > .col-xs-1-2 > #checkinTooltip0 > .mdl-button > .mdl-button__ripple-container'
      )
    } else if (
      (await page.$(
        '.row > .col-xs-1-2 > #checkinTooltip1 > .mdl-button > .mdl-button__ripple-container'
      )) !== null
    ) {
      await page.click(
        '.row > .col-xs-1-2 > #checkinTooltip1 > .mdl-button > .mdl-button__ripple-container'
      )
    }
    await navigationPromise

    logger.debug('baggage confirmation')
    await delay(5000)
    await page.waitForSelector(
      'baggage-page > #baggagesForm > .text-right > .baggage-submit > .mdl-button__ripple-container'
    )
    await page.click(
      'baggage-page > #baggagesForm > .text-right > .baggage-submit > .mdl-button__ripple-container'
    )
    await navigationPromise

    logger.debug('free random assignment')
    await page.waitForSelector(
      '.col-xs-1 > .outer-package-box > .seatmap-info > .seatmap-button-container > .secondary-btn:nth-child(1)'
    )
    await page.click(
      '.col-xs-1 > .outer-package-box > .seatmap-info > .seatmap-button-container > .secondary-btn:nth-child(1)'
    )
    await navigationPromise
    await delay(5000)

    /**
     * @param {string} selector -
     * @returns {Promise<boolean>} -
     * @example
     * const hidden = isHidden('#myId')
     */
    const isHidden = selector =>
      page.evaluate(selector => {
        /** @type {HTMLElement} */
        const btn = document.querySelector(selector)
        return btn.hidden
      }, selector)

    if (
      !(await isHidden(
        '.outer-package-box > .seatmap-info > .seatmap-button-container > .secondary-btn:nth-child(3)'
      ))
    ) {
      logger.debug('select seats at another time one way')
      await page.click(
        '.outer-package-box > .seatmap-info > .seatmap-button-container > .secondary-btn:nth-child(3)'
      )
    }

    logger.debug('continue')
    if (
      !(await isHidden(
        '.outer-package-box > .seatmap-info > .seatmap-button-container > #ctn01'
      ))
    ) {
      await page.click(
        '.outer-package-box > .seatmap-info > .seatmap-button-container > #ctn01'
      )
    } else if (
      !(await isHidden(
        '.outer-package-box > .seatmap-info > .seatmap-button-container > #ctn02'
      ))
    ) {
      await page.click(
        '.outer-package-box > .seatmap-info > .seatmap-button-container > #ctn02'
      )
    }
    await navigationPromise

    logger.debug('continue without extras')
    await page.waitForSelector(
      'div > #extrasForm > .text-right > .extras-submit > .mdl-button__ripple-container'
    )
    await page.click(
      'div > #extrasForm > .text-right > .extras-submit > .mdl-button__ripple-container'
    )
    await navigationPromise
    delay(5000)

    logger.debug('select passenger')
    await page.waitForSelector('#passenger_0')
    await page.click('#passenger_0')
    await navigationPromise
    delay(5000)

    logger.debug('continue')
    await page.waitForSelector(
      '#mainContentWrapper > .booking-wrapper > checkin-flow-passenger-container > .checkin-btn-container > .primary-btn'
    )
    await page.click(
      '#mainContentWrapper > .booking-wrapper > checkin-flow-passenger-container > .checkin-btn-container > .primary-btn'
    )
    await navigationPromise
    delay(5000)

    logger.debug('select document type RUT')
    await page.waitForSelector(
      'checkin-passenger-document > .row > .col-xs-1 > .mdl-textfield > .mdl-textfield__input:nth-child(2)'
    )
    await page.select(
      'checkin-passenger-document > .row > .col-xs-1 > .mdl-textfield > .mdl-textfield__input:nth-child(2)',
      DOCUMENT_TYPES.get('rut')
    )
    await navigationPromise

    const cleanRut = clean(rut)
    logger.debug(`type rut ${cleanRut}`)
    await page.waitForSelector(
      'checkin-passenger-document > .row > .col-xs-1:nth-child(2) > .mdl-textfield > .mdl-textfield__input'
    )
    await page.evaluate(() => {
      /** @type {HTMLInputElement} */
      const input = document.querySelector(
        'checkin-passenger-document > .row > .col-xs-1:nth-child(2) > .mdl-textfield > .mdl-textfield__input'
      )
      input.value = ''
    })
    await page.type(
      'checkin-passenger-document > .row > .col-xs-1:nth-child(2) > .mdl-textfield > .mdl-textfield__input',
      cleanRut
    )

    logger.debug(`select gender ${gender}`)
    await page.waitForSelector(
      'checkin-passenger-document #jetSmartPassengers_0__Info_Gender'
    )
    await page.select(
      'checkin-passenger-document #jetSmartPassengers_0__Info_Gender',
      GENDERS.get(gender)
    )

    logger.debug(`select birthdate day ${birthdateDay}`)
    await page.waitForSelector('.row #date_of_birth_day_0')
    await page.select('.row #date_of_birth_day_0', birthdateDay)

    logger.debug(`select birthdate month ${birthdateMonth}`)
    await page.waitForSelector('.row #date_of_birth_month_0')
    await page.select(
      '.row #date_of_birth_month_0',
      parseInt(birthdateMonth, 10).toString()
    )

    logger.debug(`select birthdate year ${birthdateYear}`)
    await page.waitForSelector('.row #date_of_birth_year_0')
    await page.select('.row #date_of_birth_year_0', birthdateYear)

    logger.debug(`type emergency contact name ${emergencyContactName}`)
    await page.waitForSelector('.inner-deep-box #emergencyContact_CompanyName')
    await page.type(
      '.inner-deep-box #emergencyContact_CompanyName',
      emergencyContactName
    )

    logger.debug(
      `type emergency contact phone number ${emergencyContactPhoneNumber}`
    )
    await page.waitForSelector('.inner-deep-box #emergencyContact_PhoneNumber')
    await page.type(
      '.inner-deep-box #emergencyContact_PhoneNumber',
      emergencyContactPhoneNumber
    )

    logger.debug(`type emergency contact email ${emergencyContactEmail}`)
    await page.waitForSelector('.inner-deep-box #emergencyContact_EmailAddress')
    await page.type(
      '.inner-deep-box #emergencyContact_EmailAddress',
      emergencyContactEmail
    )

    logger.debug('confirmation of declaration of dangerous elements')
    await page.waitForSelector(
      '.col-xs-1 > .mdl-checkbox-wrapper > .mdl-checkbox > .mdl-checkbox__box-outline > .mdl-checkbox__tick-outline'
    )
    await page.click(
      '.col-xs-1 > .mdl-checkbox-wrapper > .mdl-checkbox > .mdl-checkbox__box-outline > .mdl-checkbox__tick-outline'
    )

    logger.debug('continue')
    await page.waitForSelector(
      'app > .content-wrapper > checkin-additional-info > .checkin-btn-container > .primary-btn'
    )
    await page.click(
      'app > .content-wrapper > checkin-additional-info > .checkin-btn-container > .primary-btn'
    )
    await navigationPromise
    await delay(5000)

    logger.debug('boarding pass download for desktop')
    await page.waitForSelector(
      '#mainContentWrapper > .booking-wrapper > boarding-pass > .boarding-pass-btn-container > button:nth-child(2)'
    )
    await page.click(
      '#mainContentWrapper > .booking-wrapper > boarding-pass > .boarding-pass-btn-container > button:nth-child(2)'
    )
    await navigationPromise

    logger.debug('boarding pass download for phone')
    await page.waitForSelector(
      '#mainContentWrapper > .booking-wrapper > boarding-pass > .boarding-pass-btn-container > button:nth-child(3)'
    )
    await page.click(
      '#mainContentWrapper > .booking-wrapper > boarding-pass > .boarding-pass-btn-container > button:nth-child(3)'
    )
    await navigationPromise

    logger.debug('close browser')
    await browser.close()
    return response
  } catch (err) {
    logger.error(err)
    errors.push('EINTERNAL')
    response.statusCode = 500
    response.body = JSON.stringify({ success: false, errors })
    logger.debug('close browser')
    await browser.close()
    return response
  }
}
/* eslint-enable sonarjs/no-duplicate-string, sonarjs/cognitive-complexity */
