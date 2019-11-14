const chromium = require('chrome-aws-lambda')
const puppeteer = require('puppeteer')
const { isValid, parse } = require('date-fns')
const { validate, clean } = require('rut.js')
const logger = require('./utils/logger')

/**
 * @typedef {import('aws-lambda').APIGatewayProxyEvent} APIGatewayProxyEvent
 * @typedef {import('aws-lambda').APIGatewayProxyResult} APIGatewayProxyResult
 */
/**
 * @param {APIGatewayProxyEvent} event -
 * @returns {Promise<APIGatewayProxyResult>} -
 * @example
 * const result = await checkin(event)
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
  try {
    let body = {}
    if (event.httpMethod === 'GET') {
      body = event.queryStringParameters
    } else if (event.httpMethod === 'POST') {
      body = JSON.parse(event.body)
    }
    const { code, lastName, rut, birthDate, expireDate } = body
    logger.debug(`body: ${JSON.stringify(body)}`)
    if (!/^\w{6}$/.test(code)) errors.push('EINVALIDCODE')
    if (!validate(rut)) errors.push('EINVALIDRUT')
    if (!isValid(parse(birthDate, 'yyyy-MM-dd', new Date())))
      errors.push('EINVALIDBIRTHDAY')
    if (!isValid(parse(expireDate, 'yyyy-MM-dd', new Date())))
      errors.push('EINVALIDEXPIREDATE')
    if (errors.length > 0) {
      response.statusCode = 400
      response.body = JSON.stringify({ success: false, errors })
      return response
    }
    const CHECKIN_PAGE = 'https://www.skyairline.com/chile/administra/buscar'
    logger.debug('launch browser')
    /** @type {import('puppeteer').Browser} */
    let browser
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

    logger.debug(`go to ${CHECKIN_PAGE}`)
    await page.goto(CHECKIN_PAGE)

    await page.setViewport({ width: 1042, height: 630 })

    logger.debug(`type code (${code})`)
    await page.waitForSelector('#form0 #PNR')
    await page.type('#form0 #PNR', code)

    logger.debug(`type lastName (${lastName})`)
    await page.waitForSelector('#form0 #lastName')
    await page.type('#form0 #lastName', lastName)

    logger.debug('send form')
    await page.waitForSelector('.login-form > #form0 #continueButton')
    await page.click('.login-form > #form0 #continueButton')
    await navigationPromise

    logger.debug('go to pre checkin')
    await page.waitForSelector(
      'form > .row > .col-md-2 > .global-checkin > .custom_submit'
    )
    await page.click(
      'form > .row > .col-md-2 > .global-checkin > .custom_submit'
    )
    await navigationPromise

    logger.debug('go to checkin')
    await page.waitForSelector(
      '.row > .col-md-4 > .global-checkin > .checked-in-wrapper > .custom_submit'
    )
    await page.click(
      '.row > .col-md-4 > .global-checkin > .checked-in-wrapper > .custom_submit'
    )
    await navigationPromise

    logger.debug('confirm checkin')
    await page.waitForSelector('.col-md-12 > #servicesForm #btnSubmitForm')
    await page.click('.col-md-12 > #servicesForm #btnSubmitForm')
    await navigationPromise

    logger.debug(`type birthDate (${birthDate})`)
    await page.waitForSelector('.passenger #apisInfoBirthday0')
    await page.type('.passenger #apisInfoBirthday0', birthDate)

    logger.debug('select documen type')
    await page.waitForSelector('.col-md-4 #Profile_DocumentId')
    await page.select('.col-md-4 #Profile_DocumentId', '')

    logger.debug(`type rut (${rut})`)
    await page.waitForSelector('.row #apisInfoSSN0')
    await page.type('.row #apisInfoSSN0', clean(rut))

    await page.waitForSelector(
      'div > .passenger > .row > .col-md-2 > .common-dropdown'
    )
    await page.click('div > .passenger > .row > .col-md-2 > .common-dropdown')

    logger.debug('select gender')
    await page.waitForSelector(
      '.passenger > .row > .col-md-2 > .common-dropdown > select'
    )
    await page.select(
      '.passenger > .row > .col-md-2 > .common-dropdown > select',
      'M'
    )

    logger.debug('select country 1')
    await page.waitForSelector(
      '.passenger > .row > .col-md-3:nth-child(2) > .common-dropdown > select'
    )
    await page.select(
      '.passenger > .row > .col-md-3:nth-child(2) > .common-dropdown > select',
      '152'
    )

    logger.debug('select country 2')
    await page.waitForSelector(
      '.passenger > .row > .col-md-3:nth-child(3) > .common-dropdown > select'
    )
    await page.select(
      '.passenger > .row > .col-md-3:nth-child(3) > .common-dropdown > select',
      '152'
    )

    logger.debug(`type expire date (${expireDate})`)
    await page.waitForSelector('.passenger #expireDate0')
    await page.type('.passenger #expireDate0', expireDate)

    logger.debug('send checkin')
    await page.waitForSelector('#checkinPaymentForm #paymentSubmitButton')
    await page.click('#checkinPaymentForm #paymentSubmitButton')
    await navigationPromise

    logger.debug('send confirmation email')
    await page.waitForSelector('.confirmation-leg #btnSendEmail')
    await page.click('.confirmation-leg #btnSendEmail')

    logger.debug('close browser')
    await browser.close()
    return response
  } catch (err) {
    logger.error(err)
    errors.push('EINTERNAL')
    response.statusCode = 500
    response.body = JSON.stringify({ success: false, errors })
    return response
  }
}
